import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/widgets.dart';
import '../../auth/domain/auth_notifier.dart';
import '../data/repository.dart';

enum KyogongSection {
  reception,
  spa,
  executiveBar,
  sportsBar,
  transactions,
  shifts,
  services,
  pettyCash,
  float,
}

class KyogongSpaDashboard extends ConsumerStatefulWidget {
  const KyogongSpaDashboard({super.key, this.initialSection});

  final KyogongSection? initialSection;

  @override
  ConsumerState<KyogongSpaDashboard> createState() =>
      _KyogongSpaDashboardState();
}

class _KyogongSpaDashboardState extends ConsumerState<KyogongSpaDashboard> {
  late KyogongSection _section =
      widget.initialSection ?? KyogongSection.reception;

  @override
  Widget build(BuildContext context) {
    final isMobile = MediaQuery.of(context).size.width < 768;
    final isTablet = MediaQuery.of(context).size.width >= 768 &&
        MediaQuery.of(context).size.width < 1024;
    final navWidth = isMobile ? 0.0 : (isTablet ? 64.0 : 240.0);

    return Scaffold(
      backgroundColor: AppColors.kSurface,
      body: Row(
        children: [
          if (!isMobile)
            _KyogongSideNav(
              width: navWidth,
              isCollapsed: isTablet,
              current: _section,
              onChanged: (section) => setState(() => _section = section),
            ),
          Expanded(
            child: Column(
              children: [
                _KyogongTopBar(
                  section: _section,
                  onMenuTap: isMobile ? () => _showMobileNav(context) : null,
                ),
                Expanded(child: _buildSection()),
              ],
            ),
          ),
        ],
      ),
      bottomNavigationBar: isMobile
          ? _KyogongBottomNav(
              current: _section,
              onChanged: (section) => setState(() => _section = section),
            )
          : null,
    );
  }

  Widget _buildSection() {
    switch (_section) {
      case KyogongSection.reception:
        return const _KyogongStation(
          config: _StationConfig(
            title: 'Reception & Car Wash POS',
            subtitle: 'Famous Gates Hotels',
            serviceType: 'car_wash',
            salesPointCode: 'RECEPTION',
            supportsPettyCash: true,
          ),
        );
      case KyogongSection.spa:
        return const _KyogongStation(
          config: _StationConfig(
            title: 'Spa & Wellness POS',
            subtitle: 'Famous Gates Hotels',
            serviceType: 'spa',
            salesPointCode: 'SPA',
            supportsPettyCash: false,
          ),
        );
      case KyogongSection.executiveBar:
        return const _KyogongStation(
          config: _StationConfig(
            title: 'Executive Bar POS',
            subtitle: 'Famous Gates Hotels',
            serviceType: 'bar',
            salesPointCode: 'EXEC_BAR',
            supportsPettyCash: false,
          ),
        );
      case KyogongSection.sportsBar:
        return const _KyogongStation(
          config: _StationConfig(
            title: 'Sports Bar POS',
            subtitle: 'Famous Gates Hotels',
            serviceType: 'bar',
            salesPointCode: 'SPORTS_BAR',
            supportsPettyCash: false,
            supportsPoolTokens: true,
          ),
        );
      case KyogongSection.transactions:
        return const _TransactionsExplorer();
      case KyogongSection.shifts:
        return const _ShiftReviewSection();
      case KyogongSection.services:
        return const _ServicesSection();
      case KyogongSection.pettyCash:
        return const _PettyCashSection();
      case KyogongSection.float:
        return const _FloatSection();
    }
  }

  void _showMobileNav(BuildContext context) {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (_) => _KyogongMobileNav(
        current: _section,
        onChanged: (section) {
          setState(() => _section = section);
          Navigator.pop(context);
        },
      ),
    );
  }
}

class _StationConfig {
  const _StationConfig({
    required this.title,
    required this.subtitle,
    required this.serviceType,
    required this.salesPointCode,
    required this.supportsPettyCash,
    this.supportsPoolTokens = false,
  });

  final String title;
  final String subtitle;
  final String serviceType;
  final String salesPointCode;
  final bool supportsPettyCash;
  final bool supportsPoolTokens;
}

class _KyogongStation extends ConsumerStatefulWidget {
  const _KyogongStation({required this.config});

  final _StationConfig config;

  @override
  ConsumerState<_KyogongStation> createState() => _KyogongStationState();
}

class _KyogongStationState extends ConsumerState<_KyogongStation> {
  bool _loading = true;
  bool _saving = false;
  int _tab = 0;
  Map<String, dynamic>? _activeShift;
  List<Map<String, dynamic>> _transactions = const [];
  int _refreshTick = 0;

  @override
  void initState() {
    super.initState();
    _loadCurrentShift();
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Center(child: CircularProgressIndicator());
    }

    if (_activeShift == null) {
      return _OpenShiftPanel(
        salesPointCode: widget.config.salesPointCode,
        supportsPettyCash: widget.config.supportsPettyCash,
        onOpened: (shift) {
          setState(() {
            _activeShift = shift;
            _tab = 0;
          });
          _loadTransactions(_text(shift, ['id']));
        },
      );
    }

    final shift = _activeShift!;
    final tabs = <_StationTab>[
      const _StationTab('New Sale', Icons.point_of_sale),
      _StationTab('Transactions (${_transactions.length})', Icons.receipt_long),
      if (widget.config.supportsPettyCash)
        const _StationTab('Petty Cash', Icons.account_balance_wallet),
      const _StationTab('Float', Icons.savings),
      const _StationTab('Close Shift', Icons.logout),
    ];

    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      widget.config.title,
                      style: Theme.of(context).textTheme.headlineSmall,
                    ),
                    const SizedBox(height: 4),
                    Text(
                      widget.config.subtitle,
                      style: const TextStyle(color: AppColors.kTextSecondary),
                    ),
                  ],
                ),
              ),
              OutlinedButton.icon(
                onPressed: _saving ? null : _recalculateShift,
                icon: const Icon(Icons.refresh, size: 16),
                label: const Text('Refresh'),
              ),
              const SizedBox(width: 8),
              OutlinedButton.icon(
                onPressed: () => context.go('/cashier'),
                icon: const Icon(Icons.list_alt, size: 16),
                label: const Text('Shift Logbook'),
              ),
              const SizedBox(width: 8),
              ElevatedButton.icon(
                onPressed: _createGeneralBill,
                icon: const Icon(Icons.add, size: 16),
                label: const Text('Create General Bill'),
              ),
            ],
          ),
          const SizedBox(height: 20),
          _StationStats(shift: shift),
          const SizedBox(height: 20),
          if (widget.config.supportsPoolTokens) ...[
            const _PoolTokensPanel(),
            const SizedBox(height: 20),
          ],
          _TabStrip(
            tabs: tabs,
            selected: _tab,
            onChanged: (i) => setState(() => _tab = i),
          ),
          const SizedBox(height: 20),
          _tabBody(tabs[_tab].label),
        ],
      ),
    );
  }

  Widget _tabBody(String label) {
    final shift = _activeShift!;
    if (label.startsWith('New Sale')) {
      return _SalePanel(
        shift: shift,
        serviceType: widget.config.serviceType,
        onCreated: (tx) {
          setState(() {
            _transactions = [tx, ..._transactions];
            _refreshTick++;
          });
          _recalculateShift();
        },
      );
    }
    if (label.startsWith('Transactions')) {
      return _TransactionList(
        rows: _transactions,
        allowVoid: true,
        onVoid: _voidTransaction,
      );
    }
    if (label.startsWith('Petty Cash')) {
      return _PettyCashInline(
        shift: shift,
        onSaved: () {
          setState(() => _refreshTick++);
          _recalculateShift();
        },
      );
    }
    if (label.startsWith('Float')) {
      return _FloatInline(
        shift: shift,
        refreshTick: _refreshTick,
      );
    }
    return _CloseShiftPanel(
      shift: shift,
      onClosed: () {
        setState(() {
          _activeShift = null;
          _transactions = const [];
          _tab = 0;
        });
      },
    );
  }

  Future<void> _loadCurrentShift() async {
    setState(() => _loading = true);
    try {
      final res = await ref.read(kyogongRepositoryProvider).getCurrentShift();
      final shift = _payloadOrNull(res);
      if (shift != null && _text(shift, ['id']).isNotEmpty) {
        try {
          await ref
              .read(kyogongRepositoryProvider)
              .recalculateShift(_text(shift, ['id']));
        } catch (_) {}
        final updated =
            await ref.read(kyogongRepositoryProvider).getCurrentShift();
        final nextShift = _payloadOrNull(updated) ?? shift;
        setState(() => _activeShift = nextShift);
        await _loadTransactions(_text(nextShift, ['id']));
      } else {
        setState(() => _activeShift = null);
      }
    } catch (error) {
      _snack('Failed to load shift: $error');
      setState(() => _activeShift = null);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _loadTransactions(String shiftId) async {
    if (shiftId.isEmpty) return;
    try {
      final rows = await ref
          .read(kyogongRepositoryProvider)
          .getShiftTransactions(shiftId);
      if (mounted) setState(() => _transactions = rows);
    } catch (error) {
      _snack('Failed to load transactions: $error');
    }
  }

  Future<void> _recalculateShift() async {
    final id = _text(_activeShift ?? {}, ['id']);
    if (id.isEmpty) return;
    setState(() => _saving = true);
    try {
      await ref.read(kyogongRepositoryProvider).recalculateShift(id);
      final res = await ref.read(kyogongRepositoryProvider).getCurrentShift();
      final shift = _payloadOrNull(res);
      if (shift != null) setState(() => _activeShift = shift);
      await _loadTransactions(id);
    } catch (error) {
      _snack('Refresh failed: $error');
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Future<void> _voidTransaction(Map<String, dynamic> tx) async {
    final reason = await _textDialog(context, 'Void Transaction', 'Reason');
    if (reason == null || reason.isEmpty) return;
    try {
      await ref.read(kyogongRepositoryProvider).voidTransaction(
        _text(tx, ['id']),
        {'void_reason': reason},
      );
      _snack('Transaction voided');
      await _recalculateShift();
    } catch (error) {
      _snack('Void failed: $error');
    }
  }

  Future<void> _createGeneralBill() async {
    context.go('/cashier');
  }

  void _snack(String message) {
    if (!mounted) return;
    AppNotifier.showSnackBar(context, SnackBar(content: Text(message)));
  }
}

class _OpenShiftPanel extends ConsumerStatefulWidget {
  const _OpenShiftPanel({
    required this.salesPointCode,
    required this.supportsPettyCash,
    required this.onOpened,
  });

  final String salesPointCode;
  final bool supportsPettyCash;
  final ValueChanged<Map<String, dynamic>> onOpened;

  @override
  ConsumerState<_OpenShiftPanel> createState() => _OpenShiftPanelState();
}

class _OpenShiftPanelState extends ConsumerState<_OpenShiftPanel> {
  final _openingFloat = TextEditingController();
  final _openingPettyCash = TextEditingController();
  List<Map<String, dynamic>> _points = const [];
  String? _selectedPointId;
  bool _loading = true;
  bool _submitting = false;

  @override
  void initState() {
    super.initState();
    _loadPoints();
  }

  @override
  void dispose() {
    _openingFloat.dispose();
    _openingPettyCash.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final selected = _points
        .where((point) => _text(point, ['id']) == _selectedPointId)
        .firstOrNull;
    final supportsPetty =
        selected?['supports_petty_cash'] == true || widget.supportsPettyCash;

    return Center(
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Container(
          constraints: const BoxConstraints(maxWidth: 460),
          child: Card(
            child: Padding(
              padding: const EdgeInsets.all(28),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  CircleAvatar(
                    radius: 32,
                    backgroundColor: AppColors.kPrimary.withValues(alpha: 0.08),
                    child: const Icon(Icons.store, color: AppColors.kPrimary),
                  ),
                  const SizedBox(height: 16),
                  Text('Open New Shift',
                      style: Theme.of(context).textTheme.titleLarge),
                  const SizedBox(height: 6),
                  const Text(
                    'Start your Kyogong cashier shift to begin sales.',
                    textAlign: TextAlign.center,
                    style: TextStyle(color: AppColors.kTextSecondary),
                  ),
                  const SizedBox(height: 24),
                  if (_loading)
                    const LinearProgressIndicator()
                  else
                    DropdownButtonFormField<String>(
                      initialValue: _selectedPointId,
                      decoration:
                          const InputDecoration(labelText: 'Sales Point'),
                      items: _points
                          .map(
                            (point) => DropdownMenuItem(
                              value: _text(point, ['id']),
                              child: Text(_text(point, ['name', 'code'])),
                            ),
                          )
                          .toList(),
                      onChanged: (value) =>
                          setState(() => _selectedPointId = value),
                    ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: _openingFloat,
                    keyboardType: TextInputType.number,
                    decoration: const InputDecoration(
                      labelText: 'Opening Float',
                      prefixText: 'KES ',
                    ),
                  ),
                  if (supportsPetty) ...[
                    const SizedBox(height: 12),
                    TextField(
                      controller: _openingPettyCash,
                      keyboardType: TextInputType.number,
                      decoration: const InputDecoration(
                        labelText: 'Opening Petty Cash',
                        prefixText: 'KES ',
                      ),
                    ),
                  ],
                  const SizedBox(height: 20),
                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton.icon(
                      onPressed: _submitting ? null : _openShift,
                      icon: const Icon(Icons.play_arrow, size: 16),
                      label: Text(_submitting ? 'Opening...' : 'Start Shift'),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  Future<void> _loadPoints() async {
    setState(() => _loading = true);
    try {
      final points = await ref
          .read(kyogongRepositoryProvider)
          .getSalesPoints(isActive: true);
      final matched = points.where((p) {
        return _text(p, ['code']).toUpperCase() ==
            widget.salesPointCode.toUpperCase();
      }).firstOrNull;
      setState(() {
        _points = points;
        _selectedPointId =
            _text(matched ?? (points.isNotEmpty ? points.first : {}), ['id']);
      });
    } catch (error) {
      _snack('Failed to load sales points: $error');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _openShift() async {
    final pointId = _selectedPointId;
    final openingFloat = num.tryParse(_openingFloat.text.trim()) ?? -1;
    if (pointId == null || pointId.isEmpty) {
      return _snack('Select a sales point');
    }
    if (openingFloat < 0) return _snack('Enter a valid opening float');

    setState(() => _submitting = true);
    try {
      final res = await ref.read(kyogongRepositoryProvider).openShift({
        'sales_point_id': int.tryParse(pointId) ?? pointId,
        'opening_cash_float': openingFloat,
        'opening_petty_cash': num.tryParse(_openingPettyCash.text.trim()) ?? 0,
      });
      final shift = _payloadOrNull(res);
      if (shift == null) throw Exception(_text(res, ['error', 'message']));
      widget.onOpened(shift);
      _snack('Shift opened');
    } catch (error) {
      _snack('Open shift failed: $error');
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  void _snack(String message) {
    if (!mounted) return;
    AppNotifier.showSnackBar(context, SnackBar(content: Text(message)));
  }
}

class _SalePanel extends ConsumerStatefulWidget {
  const _SalePanel({
    required this.shift,
    required this.serviceType,
    required this.onCreated,
  });

  final Map<String, dynamic> shift;
  final String serviceType;
  final ValueChanged<Map<String, dynamic>> onCreated;

  @override
  ConsumerState<_SalePanel> createState() => _SalePanelState();
}

class _SalePanelState extends ConsumerState<_SalePanel> {
  final _customerName = TextEditingController();
  final _customerPhone = TextEditingController();
  final _mpesaReference = TextEditingController();
  List<Map<String, dynamic>> _services = const [];
  final List<Map<String, dynamic>> _cart = [];
  String _paymentMethod = 'BILL';
  bool _loading = true;
  bool _saving = false;
  Map<String, dynamic>? _lastTransaction;

  @override
  void initState() {
    super.initState();
    _loadServices();
  }

  @override
  void dispose() {
    _customerName.dispose();
    _customerPhone.dispose();
    _mpesaReference.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final total = _cart.fold<num>(0,
        (sum, item) => sum + _num(item['quantity']) * _num(item['unit_price']));
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Expanded(
          flex: 3,
          child: Card(
            child: Padding(
              padding: const EdgeInsets.all(20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Services',
                      style: Theme.of(context).textTheme.titleMedium),
                  const SizedBox(height: 12),
                  if (_loading)
                    const LoadingSkeleton(type: SkeletonType.grid)
                  else if (_services.isEmpty)
                    const EmptyState(message: 'No active services found')
                  else
                    GridView.builder(
                      shrinkWrap: true,
                      physics: const NeverScrollableScrollPhysics(),
                      gridDelegate:
                          const SliverGridDelegateWithMaxCrossAxisExtent(
                        maxCrossAxisExtent: 220,
                        mainAxisExtent: 116,
                        crossAxisSpacing: 12,
                        mainAxisSpacing: 12,
                      ),
                      itemCount: _services.length,
                      itemBuilder: (_, index) {
                        final service = _services[index];
                        return InkWell(
                          onTap: () => _addToCart(service),
                          borderRadius: BorderRadius.circular(8),
                          child: Container(
                            padding: const EdgeInsets.all(14),
                            decoration: BoxDecoration(
                              color: Colors.white,
                              borderRadius: BorderRadius.circular(8),
                              border: Border.all(color: AppColors.kDivider),
                            ),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  _text(service, ['name']),
                                  maxLines: 2,
                                  overflow: TextOverflow.ellipsis,
                                  style: const TextStyle(
                                    fontWeight: FontWeight.bold,
                                  ),
                                ),
                                const Spacer(),
                                Text(
                                  _money(service['base_price'] ??
                                      service['price']),
                                  style: const TextStyle(
                                    color: AppColors.kPrimary,
                                    fontWeight: FontWeight.w800,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        );
                      },
                    ),
                ],
              ),
            ),
          ),
        ),
        const SizedBox(width: 16),
        Expanded(
          flex: 2,
          child: Card(
            child: Padding(
              padding: const EdgeInsets.all(20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text('Order',
                            style: Theme.of(context).textTheme.titleMedium),
                      ),
                      if (_lastTransaction != null)
                        TextButton.icon(
                          onPressed: () => _copyReceipt(_lastTransaction!),
                          icon: const Icon(Icons.print, size: 16),
                          label: const Text('Receipt'),
                        ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: _customerName,
                    decoration:
                        const InputDecoration(labelText: 'Customer name'),
                  ),
                  const SizedBox(height: 10),
                  TextField(
                    controller: _customerPhone,
                    decoration:
                        const InputDecoration(labelText: 'Customer phone'),
                  ),
                  const SizedBox(height: 14),
                  if (_cart.isEmpty)
                    const EmptyState(message: 'Select services above')
                  else
                    ListView.separated(
                      shrinkWrap: true,
                      physics: const NeverScrollableScrollPhysics(),
                      itemCount: _cart.length,
                      separatorBuilder: (_, __) => const Divider(height: 1),
                      itemBuilder: (_, index) {
                        final item = _cart[index];
                        return ListTile(
                          contentPadding: EdgeInsets.zero,
                          title: Text(_text(item, ['item_name'])),
                          subtitle: Text(_money(item['unit_price'])),
                          trailing: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              IconButton(
                                onPressed: () => _changeQty(index, -1),
                                icon: const Icon(Icons.remove_circle_outline),
                              ),
                              Text('${item['quantity']}'),
                              IconButton(
                                onPressed: () => _changeQty(index, 1),
                                icon: const Icon(Icons.add_circle_outline),
                              ),
                            ],
                          ),
                        );
                      },
                    ),
                  const Divider(height: 28),
                  _KeyValueRow(label: 'Subtotal', value: _money(total)),
                  _KeyValueRow(label: 'VAT', value: _money(0)),
                  _KeyValueRow(
                    label: 'Total',
                    value: _money(total),
                    prominent: true,
                  ),
                  const SizedBox(height: 14),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: [
                      _paymentChip('BILL', 'Bill'),
                      _paymentChip('CASH', 'Cash'),
                      _paymentChip('MPESA', 'M-Pesa'),
                      _paymentChip('CARD', 'Card'),
                    ],
                  ),
                  if (_paymentMethod == 'MPESA') ...[
                    const SizedBox(height: 10),
                    TextField(
                      controller: _mpesaReference,
                      decoration:
                          const InputDecoration(labelText: 'M-Pesa reference'),
                    ),
                  ],
                  const SizedBox(height: 16),
                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton.icon(
                      onPressed: _cart.isEmpty || _saving ? null : _submit,
                      icon: const Icon(Icons.receipt_long, size: 16),
                      label: Text(
                        _paymentMethod == 'BILL'
                            ? 'Generate Bill'
                            : 'Process Sale',
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ],
    );
  }

  Widget _paymentChip(String value, String label) {
    return ChoiceChip(
      selected: _paymentMethod == value,
      label: Text(label),
      onSelected: (_) => setState(() => _paymentMethod = value),
    );
  }

  Future<void> _loadServices() async {
    setState(() => _loading = true);
    try {
      final rows = await ref.read(kyogongRepositoryProvider).getDynamicServices(
            serviceType: widget.serviceType,
            isActive: true,
          );
      setState(() => _services = rows);
    } catch (error) {
      _snack('Failed to load services: $error');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  void _addToCart(Map<String, dynamic> service) {
    final id = _text(service, ['id']);
    final index = _cart.indexWhere((item) => _text(item, ['item_id']) == id);
    setState(() {
      if (index >= 0) {
        _cart[index] = {
          ..._cart[index],
          'quantity': _num(_cart[index]['quantity']) + 1,
        };
      } else {
        _cart.add({
          'item_id': id,
          'item_name': _text(service, ['name']),
          'item_type': _text(service, ['service_type']),
          'quantity': 1,
          'unit_price': _num(service['base_price'] ?? service['price']),
        });
      }
    });
  }

  void _changeQty(int index, int delta) {
    setState(() {
      final nextQty = _num(_cart[index]['quantity']) + delta;
      if (nextQty <= 0) {
        _cart.removeAt(index);
      } else {
        _cart[index] = {..._cart[index], 'quantity': nextQty};
      }
    });
  }

  Future<void> _submit() async {
    final total = _cart.fold<num>(0,
        (sum, item) => sum + _num(item['quantity']) * _num(item['unit_price']));
    if (_paymentMethod == 'CASH') {
      final cash = await _cashPaymentDialog(context, total);
      if (cash == null) return;
      await _createTransaction(cashAmount: cash);
      return;
    }
    await _createTransaction();
  }

  Future<void> _createTransaction({num? cashAmount}) async {
    final total = _cart.fold<num>(0,
        (sum, item) => sum + _num(item['quantity']) * _num(item['unit_price']));
    setState(() => _saving = true);
    try {
      final method = _paymentMethod;
      final res = await ref.read(kyogongRepositoryProvider).createTransaction(
        _text(widget.shift, ['id']),
        {
          'service_category': widget.serviceType,
          'items': _cart,
          'customer_name': _customerName.text.trim().isEmpty
              ? null
              : _customerName.text.trim(),
          'customer_phone': _customerPhone.text.trim().isEmpty
              ? null
              : _customerPhone.text.trim(),
          'payment_method': method,
          'cash_amount': method == 'CASH' ? cashAmount ?? total : 0,
          'mpesa_amount': method == 'MPESA' ? total : 0,
          'card_amount': method == 'CARD' ? total : 0,
          'mpesa_reference':
              method == 'MPESA' ? _mpesaReference.text.trim() : null,
        },
      );
      final tx = _payloadOrNull(res);
      if (tx == null) throw Exception(_text(res, ['error', 'message']));
      widget.onCreated(tx);
      setState(() {
        _lastTransaction = tx;
        _cart.clear();
        _customerName.clear();
        _customerPhone.clear();
        _mpesaReference.clear();
      });
      if (method == 'BILL' && mounted) {
        AppNotifier.showSnackBar(
          context,
          SnackBar(
            content: Text(
              'Bill ${_text(tx, [
                    'transaction_number',
                    'id'
                  ])} created for cashier station',
            ),
            action: SnackBarAction(
              label: 'Cashier',
              onPressed: () => context.go('/cashier'),
            ),
          ),
        );
      } else {
        _copyReceipt(tx);
        _snack('Sale recorded');
      }
    } catch (error) {
      _snack('Sale failed: $error');
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  void _copyReceipt(Map<String, dynamic> tx) {
    final items = _list(tx['items'])
        .map((item) =>
            '${item['quantity']} x ${item['item_name']} ${_money(item['total_price'])}')
        .join('\n');
    final receipt = '''
FAMOUS GATES HOTELS
Receipt: ${_text(tx, ['transaction_number', 'id'])}
Date: ${_date(tx['created_at'])}
Customer: ${_text(tx, ['customer_name'])}

$items

Total: ${_money(tx['total_amount'])}
Payment: ${_text(tx, ['payment_method'])}
''';
    Clipboard.setData(ClipboardData(text: receipt));
    _snack('Receipt copied');
  }

  void _snack(String message) {
    if (!mounted) return;
    AppNotifier.showSnackBar(context, SnackBar(content: Text(message)));
  }
}

class _CloseShiftPanel extends ConsumerStatefulWidget {
  const _CloseShiftPanel({required this.shift, required this.onClosed});

  final Map<String, dynamic> shift;
  final VoidCallback onClosed;

  @override
  ConsumerState<_CloseShiftPanel> createState() => _CloseShiftPanelState();
}

class _CloseShiftPanelState extends ConsumerState<_CloseShiftPanel> {
  final _closingCash = TextEditingController();
  final _closingPettyCash = TextEditingController();
  final _varianceReason = TextEditingController();
  bool _saving = false;

  @override
  void dispose() {
    _closingCash.dispose();
    _closingPettyCash.dispose();
    _varianceReason.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final expected = _num(widget.shift['opening_cash_float']) +
        _num(widget.shift['cash_sales']);
    final counted = num.tryParse(_closingCash.text.trim());
    final variance = counted == null ? null : counted - expected;
    final varianceIsLarge = variance != null &&
        variance.abs() > (expected * 0.05).clamp(1000, double.infinity);

    return Center(
      child: Container(
        constraints: const BoxConstraints(maxWidth: 540),
        child: Card(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Center(
                  child: Text('Close Shift',
                      style: Theme.of(context).textTheme.titleLarge),
                ),
                const SizedBox(height: 20),
                _KeyValueRow(
                    label: 'Opening Float',
                    value: _money(widget.shift['opening_cash_float'])),
                _KeyValueRow(
                    label: 'Cash Sales',
                    value: _money(widget.shift['cash_sales'])),
                _KeyValueRow(
                    label: 'Expected Cash',
                    value: _money(expected),
                    prominent: true),
                _KeyValueRow(
                    label: 'Total Sales',
                    value: _money(widget.shift['total_sales']),
                    prominent: true),
                const SizedBox(height: 16),
                TextField(
                  controller: _closingCash,
                  keyboardType: TextInputType.number,
                  onChanged: (_) => setState(() {}),
                  decoration: const InputDecoration(
                    labelText: 'Closing cash counted',
                    prefixText: 'KES ',
                  ),
                ),
                if (widget.shift['sales_point'] is Map &&
                    widget.shift['sales_point']['supports_petty_cash'] ==
                        true) ...[
                  const SizedBox(height: 12),
                  TextField(
                    controller: _closingPettyCash,
                    keyboardType: TextInputType.number,
                    decoration: const InputDecoration(
                      labelText: 'Closing petty cash',
                      prefixText: 'KES ',
                    ),
                  ),
                ],
                if (variance != null) ...[
                  const SizedBox(height: 10),
                  Text(
                    'Variance: ${_money(variance)}',
                    style: TextStyle(
                      color:
                          variance >= 0 ? AppColors.kSuccess : AppColors.kError,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ],
                if (varianceIsLarge) ...[
                  const SizedBox(height: 12),
                  TextField(
                    controller: _varianceReason,
                    maxLines: 3,
                    decoration: const InputDecoration(
                      labelText: 'Variance explanation',
                    ),
                  ),
                ],
                const SizedBox(height: 18),
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton.icon(
                    onPressed: _saving ? null : _close,
                    icon: const Icon(Icons.logout, size: 16),
                    label:
                        Text(_saving ? 'Closing...' : 'Close & Submit Shift'),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.kError,
                      foregroundColor: Colors.white,
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

  Future<void> _close() async {
    final counted = num.tryParse(_closingCash.text.trim());
    if (counted == null) return _snack('Closing cash count is required');
    setState(() => _saving = true);
    try {
      await ref.read(kyogongRepositoryProvider).closeShift(
        _text(widget.shift, ['id']),
        {
          'closing_cash_counted': counted,
          if (_closingPettyCash.text.trim().isNotEmpty)
            'closing_petty_cash': num.tryParse(_closingPettyCash.text.trim()),
          if (_varianceReason.text.trim().isNotEmpty)
            'variance_reason': _varianceReason.text.trim(),
        },
      );
      _snack('Shift closed');
      widget.onClosed();
    } catch (error) {
      _snack('Close shift failed: $error');
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  void _snack(String message) {
    if (!mounted) return;
    AppNotifier.showSnackBar(context, SnackBar(content: Text(message)));
  }
}

class _TransactionsExplorer extends ConsumerWidget {
  const _TransactionsExplorer();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return FutureBuilder<Map<String, dynamic>>(
      future: ref.read(kyogongRepositoryProvider).getCurrentShift(),
      builder: (context, snapshot) {
        final shift = _payloadOrNull(snapshot.data ?? {});
        final id = shift == null ? '' : _text(shift, ['id']);
        if (snapshot.connectionState == ConnectionState.waiting) {
          return const LoadingSkeleton(type: SkeletonType.list);
        }
        if (id.isEmpty) {
          return const EmptyState(message: 'Open a shift to view transactions');
        }
        return FutureBuilder<List<Map<String, dynamic>>>(
          future: ref.read(kyogongRepositoryProvider).getShiftTransactions(id),
          builder: (context, txSnapshot) {
            if (txSnapshot.connectionState == ConnectionState.waiting) {
              return const LoadingSkeleton(type: SkeletonType.list);
            }
            return SingleChildScrollView(
              padding: const EdgeInsets.all(24),
              child: _TransactionList(rows: txSnapshot.data ?? const []),
            );
          },
        );
      },
    );
  }
}

class _ShiftReviewSection extends ConsumerStatefulWidget {
  const _ShiftReviewSection();

  @override
  ConsumerState<_ShiftReviewSection> createState() =>
      _ShiftReviewSectionState();
}

class _ShiftReviewSectionState extends ConsumerState<_ShiftReviewSection> {
  String _status = 'all';
  late Future<List<Map<String, dynamic>>> _future = _load();

  Future<List<Map<String, dynamic>>> _load() {
    return ref.read(kyogongRepositoryProvider).getShifts(status: _status);
  }

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Column(
        children: [
          Row(
            children: [
              Expanded(
                child: Text('Kyogong Shifts',
                    style: Theme.of(context).textTheme.titleLarge),
              ),
              DropdownButton<String>(
                value: _status,
                items: const [
                  DropdownMenuItem(value: 'all', child: Text('All')),
                  DropdownMenuItem(value: 'OPEN', child: Text('Open')),
                  DropdownMenuItem(value: 'CLOSED', child: Text('Closed')),
                  DropdownMenuItem(
                      value: 'RECONCILED', child: Text('Reconciled')),
                  DropdownMenuItem(value: 'FLAGGED', child: Text('Flagged')),
                ],
                onChanged: (value) {
                  setState(() {
                    _status = value ?? 'all';
                    _future = _load();
                  });
                },
              ),
              const SizedBox(width: 8),
              OutlinedButton.icon(
                onPressed: () => setState(() {
                  _future = _load();
                }),
                icon: const Icon(Icons.refresh, size: 16),
                label: const Text('Refresh'),
              ),
            ],
          ),
          const SizedBox(height: 16),
          FutureBuilder<List<Map<String, dynamic>>>(
            future: _future,
            builder: (context, snapshot) {
              if (snapshot.connectionState == ConnectionState.waiting) {
                return const LoadingSkeleton(type: SkeletonType.list);
              }
              final rows = snapshot.data ?? const [];
              if (rows.isEmpty) {
                return const EmptyState(message: 'No shifts found');
              }
              return Card(
                child: ListView.separated(
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  itemCount: rows.length,
                  separatorBuilder: (_, __) => const Divider(height: 1),
                  itemBuilder: (_, index) {
                    final row = rows[index];
                    return ExpansionTile(
                      leading: Icon(Icons.access_time,
                          color: _statusColor(_text(row, ['status']))),
                      title: Text(_text(row, ['shift_number', 'id'])),
                      subtitle: Text(
                        '${_text(_asMap(row['sales_point']), [
                              'name',
                              'code'
                            ])} - ${_text(row, ['status'])}',
                      ),
                      trailing: Text(
                          _money(row['total_sales'] ?? row['total_revenue'])),
                      childrenPadding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
                      children: [
                        _InfoGrid(values: {
                          'Opened':
                              _date(row['opened_at'] ?? row['start_time']),
                          'Cash':
                              _money(row['cash_sales'] ?? row['total_cash_in']),
                          'M-Pesa': _money(
                              row['mpesa_sales'] ?? row['total_mpesa_in']),
                          'Card':
                              _money(row['card_sales'] ?? row['total_card_in']),
                          'Opening float': _money(row['opening_cash_float'] ??
                              row['opening_float']),
                        }),
                        const SizedBox(height: 10),
                        Wrap(
                          spacing: 8,
                          runSpacing: 8,
                          children: [
                            OutlinedButton.icon(
                              onPressed: () => _approve(row),
                              icon: const Icon(Icons.check, size: 16),
                              label: const Text('Approve'),
                            ),
                            OutlinedButton.icon(
                              onPressed: () => _flag(row),
                              icon: const Icon(Icons.flag, size: 16),
                              label: const Text('Flag'),
                            ),
                          ],
                        ),
                      ],
                    );
                  },
                ),
              );
            },
          ),
        ],
      ),
    );
  }

  Future<void> _approve(Map<String, dynamic> row) async {
    try {
      await ref.read(kyogongRepositoryProvider).approveShift(_text(row, ['id']),
          {'notes': 'Approved from Flutter Kyogong module'});
      setState(() {
        _future = _load();
      });
    } catch (error) {
      _snack('Approve failed: $error');
    }
  }

  Future<void> _flag(Map<String, dynamic> row) async {
    final reason = await _textDialog(context, 'Flag Shift', 'Reason');
    if (reason == null || reason.isEmpty) return;
    try {
      await ref
          .read(kyogongRepositoryProvider)
          .flagShift(_text(row, ['id']), {'reason': reason});
      setState(() {
        _future = _load();
      });
    } catch (error) {
      _snack('Flag failed: $error');
    }
  }

  void _snack(String message) {
    if (!mounted) return;
    AppNotifier.showSnackBar(context, SnackBar(content: Text(message)));
  }
}

class _ServicesSection extends ConsumerStatefulWidget {
  const _ServicesSection();

  @override
  ConsumerState<_ServicesSection> createState() => _ServicesSectionState();
}

class _ServicesSectionState extends ConsumerState<_ServicesSection> {
  String _type = 'all';
  late Future<List<Map<String, dynamic>>> _future = _load();

  Future<List<Map<String, dynamic>>> _load() {
    return ref.read(kyogongRepositoryProvider).getDynamicServices(
          serviceType: _type == 'all' ? null : _type,
          isActive: true,
        );
  }

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Column(
        children: [
          Row(
            children: [
              Expanded(
                child: Text('Kyogong Services',
                    style: Theme.of(context).textTheme.titleLarge),
              ),
              DropdownButton<String>(
                value: _type,
                items: const [
                  DropdownMenuItem(value: 'all', child: Text('All')),
                  DropdownMenuItem(value: 'car_wash', child: Text('Car Wash')),
                  DropdownMenuItem(value: 'spa', child: Text('Spa')),
                  DropdownMenuItem(value: 'bar', child: Text('Bar')),
                  DropdownMenuItem(value: 'pool', child: Text('Pool')),
                ],
                onChanged: (value) => setState(() {
                  _type = value ?? 'all';
                  _future = _load();
                }),
              ),
              const SizedBox(width: 8),
              ElevatedButton.icon(
                onPressed: _createService,
                icon: const Icon(Icons.add, size: 16),
                label: const Text('Service'),
              ),
            ],
          ),
          const SizedBox(height: 16),
          FutureBuilder<List<Map<String, dynamic>>>(
            future: _future,
            builder: (context, snapshot) {
              if (snapshot.connectionState == ConnectionState.waiting) {
                return const LoadingSkeleton(type: SkeletonType.list);
              }
              final rows = snapshot.data ?? const [];
              if (rows.isEmpty) {
                return const EmptyState(message: 'No services found');
              }
              return Card(
                child: ListView.separated(
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  itemCount: rows.length,
                  separatorBuilder: (_, __) => const Divider(height: 1),
                  itemBuilder: (_, index) {
                    final row = rows[index];
                    return ListTile(
                      leading: const Icon(Icons.local_offer),
                      title: Text(_text(row, ['name'])),
                      subtitle: Text(
                        '${_text(row, ['service_type'])} - ${_text(row, [
                              'pricing_model'
                            ])}',
                      ),
                      trailing: Wrap(
                        spacing: 8,
                        crossAxisAlignment: WrapCrossAlignment.center,
                        children: [
                          Text(
                            _money(row['base_price'] ?? row['price']),
                            style: const TextStyle(fontWeight: FontWeight.bold),
                          ),
                          IconButton(
                            onPressed: () => _editService(row),
                            icon: const Icon(Icons.edit, size: 18),
                          ),
                        ],
                      ),
                    );
                  },
                ),
              );
            },
          ),
        ],
      ),
    );
  }

  Future<void> _createService() async {
    final body = await _serviceDialog(context);
    if (body == null) return;
    try {
      await ref.read(kyogongRepositoryProvider).createDynamicService(body);
      setState(() {
        _future = _load();
      });
    } catch (error) {
      _snack('Create failed: $error');
    }
  }

  Future<void> _editService(Map<String, dynamic> row) async {
    final body = await _serviceDialog(context, row: row);
    if (body == null) return;
    try {
      await ref
          .read(kyogongRepositoryProvider)
          .updateDynamicService(_text(row, ['id']), body);
      setState(() {
        _future = _load();
      });
    } catch (error) {
      _snack('Update failed: $error');
    }
  }

  void _snack(String message) {
    if (!mounted) return;
    AppNotifier.showSnackBar(context, SnackBar(content: Text(message)));
  }
}

class _PettyCashSection extends ConsumerStatefulWidget {
  const _PettyCashSection();

  @override
  ConsumerState<_PettyCashSection> createState() => _PettyCashSectionState();
}

class _PettyCashSectionState extends ConsumerState<_PettyCashSection> {
  late Future<List<Map<String, dynamic>>> _future = _load();

  Future<List<Map<String, dynamic>>> _load() =>
      ref.read(kyogongRepositoryProvider).getPettyCashEntries();

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Column(
        children: [
          Row(
            children: [
              Expanded(
                child: Text('Petty Cash Ledger',
                    style: Theme.of(context).textTheme.titleLarge),
              ),
              ElevatedButton.icon(
                onPressed: () async {
                  final body = await _pettyCashDialog(context, null);
                  if (body == null) return;
                  await ref
                      .read(kyogongRepositoryProvider)
                      .recordPettyCash(body);
                  setState(() {
                    _future = _load();
                  });
                },
                icon: const Icon(Icons.add, size: 16),
                label: const Text('Entry'),
              ),
            ],
          ),
          const SizedBox(height: 16),
          FutureBuilder<List<Map<String, dynamic>>>(
            future: _future,
            builder: (context, snapshot) {
              if (snapshot.connectionState == ConnectionState.waiting) {
                return const LoadingSkeleton(type: SkeletonType.list);
              }
              return _PettyCashList(rows: snapshot.data ?? const []);
            },
          ),
        ],
      ),
    );
  }
}

class _PettyCashInline extends ConsumerWidget {
  const _PettyCashInline({required this.shift, required this.onSaved});

  final Map<String, dynamic> shift;
  final VoidCallback onSaved;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final shiftId = _text(shift, ['id']);
    return FutureBuilder<List<Map<String, dynamic>>>(
      future: ref
          .read(kyogongRepositoryProvider)
          .getPettyCashEntries(shiftId: shiftId),
      builder: (context, snapshot) {
        return Card(
          child: Padding(
            padding: const EdgeInsets.all(20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text('Petty Cash',
                          style: Theme.of(context).textTheme.titleMedium),
                    ),
                    ElevatedButton.icon(
                      onPressed: () async {
                        final body = await _pettyCashDialog(context, shiftId);
                        if (body == null) return;
                        await ref
                            .read(kyogongRepositoryProvider)
                            .recordPettyCash(body);
                        onSaved();
                      },
                      icon: const Icon(Icons.add, size: 16),
                      label: const Text('Entry'),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                if (snapshot.connectionState == ConnectionState.waiting)
                  const LoadingSkeleton(type: SkeletonType.list)
                else
                  _PettyCashList(rows: snapshot.data ?? const []),
              ],
            ),
          ),
        );
      },
    );
  }
}

class _FloatSection extends ConsumerWidget {
  const _FloatSection();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return FutureBuilder<Map<String, dynamic>>(
      future: ref.read(kyogongRepositoryProvider).getCurrentShift(),
      builder: (context, snapshot) {
        final shift = _payloadOrNull(snapshot.data ?? {});
        if (snapshot.connectionState == ConnectionState.waiting) {
          return const LoadingSkeleton(type: SkeletonType.list);
        }
        if (shift == null) {
          return const EmptyState(
              message: 'No active shift for float tracking');
        }
        return SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: _FloatInline(shift: shift, refreshTick: 0),
        );
      },
    );
  }
}

class _FloatInline extends ConsumerWidget {
  const _FloatInline({required this.shift, required this.refreshTick});

  final Map<String, dynamic> shift;
  final int refreshTick;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final shiftId = _text(shift, ['id']);
    return FutureBuilder<List<dynamic>>(
      key: ValueKey('$shiftId-$refreshTick'),
      future: Future.wait([
        ref.read(kyogongRepositoryProvider).getCurrentFloat(shiftId),
        ref.read(kyogongRepositoryProvider).getFloatHistory(shiftId),
      ]),
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting) {
          return const LoadingSkeleton(type: SkeletonType.list);
        }
        final floatData = _payloadOrNull(snapshot.data?[0] ?? {}) ?? {};
        final history =
            (snapshot.data?[1] as List<Map<String, dynamic>>?) ?? const [];
        return Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: Card(
                child: Padding(
                  padding: const EdgeInsets.all(20),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('Cash Float',
                          style: Theme.of(context).textTheme.titleMedium),
                      const SizedBox(height: 12),
                      _InfoGrid(values: {
                        'Current Float': _money(floatData['currentFloat'] ??
                            floatData['current_float'] ??
                            shift['current_float']),
                        'Opening Float': _money(floatData['openingFloat'] ??
                            floatData['opening_float'] ??
                            shift['opening_cash_float']),
                        'Expected Closing': _money(
                            floatData['expectedClosingCash'] ??
                                floatData['expected_cash'] ??
                                shift['expected_cash']),
                        'Last Updated': _date(floatData['lastUpdated'] ??
                            floatData['last_float_update']),
                      }),
                    ],
                  ),
                ),
              ),
            ),
            const SizedBox(width: 16),
            Expanded(
              child: Card(
                child: Padding(
                  padding: const EdgeInsets.all(20),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('Float History',
                          style: Theme.of(context).textTheme.titleMedium),
                      const SizedBox(height: 12),
                      if (history.isEmpty)
                        const EmptyState(message: 'No float history')
                      else
                        ListView.separated(
                          shrinkWrap: true,
                          physics: const NeverScrollableScrollPhysics(),
                          itemCount: history.length,
                          separatorBuilder: (_, __) => const Divider(height: 1),
                          itemBuilder: (_, index) {
                            final row = history[index];
                            return ListTile(
                              dense: true,
                              title: Text(_money(row['amount'] ??
                                  row['new_float'] ??
                                  row['adjustment_amount'])),
                              subtitle: Text(
                                '${_text(row, [
                                      'change_type',
                                      'reason'
                                    ])} - ${_date(row['created_at'] ?? row['timestamp'])}',
                              ),
                            );
                          },
                        ),
                    ],
                  ),
                ),
              ),
            ),
          ],
        );
      },
    );
  }
}

class _PoolTokensPanel extends ConsumerWidget {
  const _PoolTokensPanel();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return FutureBuilder<List<Map<String, dynamic>>>(
      future: ref.read(kyogongRepositoryProvider).getPoolTokensInventory(),
      builder: (context, snapshot) {
        final rows = snapshot.data ?? const [];
        return Card(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              children: [
                const Icon(Icons.confirmation_number,
                    color: AppColors.kPrimary),
                const SizedBox(width: 12),
                const Expanded(
                  child: Text(
                    'Pool Tokens',
                    style: TextStyle(fontWeight: FontWeight.bold),
                  ),
                ),
                if (snapshot.connectionState == ConnectionState.waiting)
                  const SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                else
                  Text('${rows.length} inventory lines'),
              ],
            ),
          ),
        );
      },
    );
  }
}

class _TransactionList extends StatelessWidget {
  const _TransactionList({
    required this.rows,
    this.allowVoid = false,
    this.onVoid,
  });

  final List<Map<String, dynamic>> rows;
  final bool allowVoid;
  final ValueChanged<Map<String, dynamic>>? onVoid;

  @override
  Widget build(BuildContext context) {
    if (rows.isEmpty) return const EmptyState(message: 'No transactions found');
    return Card(
      child: ListView.separated(
        shrinkWrap: true,
        physics: const NeverScrollableScrollPhysics(),
        itemCount: rows.length,
        separatorBuilder: (_, __) => const Divider(height: 1),
        itemBuilder: (_, index) {
          final row = rows[index];
          final payment = _text(row, ['payment_method']).isEmpty
              ? 'CASH'
              : _text(row, ['payment_method']);
          return ExpansionTile(
            leading: CircleAvatar(
              backgroundColor: _paymentColor(payment).withValues(alpha: 0.12),
              child: Icon(Icons.receipt_long, color: _paymentColor(payment)),
            ),
            title: Text(_text(row, ['transaction_number', 'id'])),
            subtitle: Text(
              '${_text(row, ['customer_name'])} - ${_date(row['created_at'])}',
            ),
            trailing: Text(
              _money(row['total_amount']),
              style: const TextStyle(fontWeight: FontWeight.bold),
            ),
            childrenPadding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
            children: [
              _InfoGrid(values: {
                'Payment': payment,
                'Cash': _money(row['cash_amount']),
                'M-Pesa': _money(row['mpesa_amount']),
                'Card': _money(row['card_amount']),
                'Items': '${_list(row['items']).length}',
              }),
              const SizedBox(height: 8),
              if (_list(row['items']).isNotEmpty)
                ..._list(row['items']).map(
                  (item) => ListTile(
                    dense: true,
                    contentPadding: EdgeInsets.zero,
                    title: Text(_text(item, ['item_name', 'name'])),
                    subtitle: Text('Qty ${item['quantity'] ?? 1}'),
                    trailing: Text(_money(item['total_price'] ??
                        (_num(item['quantity']) * _num(item['unit_price'])))),
                  ),
                ),
              if (allowVoid)
                Align(
                  alignment: Alignment.centerRight,
                  child: OutlinedButton.icon(
                    onPressed: () => onVoid?.call(row),
                    icon: const Icon(Icons.block, size: 16),
                    label: const Text('Void'),
                  ),
                ),
            ],
          );
        },
      ),
    );
  }
}

class _PettyCashList extends StatelessWidget {
  const _PettyCashList({required this.rows});

  final List<Map<String, dynamic>> rows;

  @override
  Widget build(BuildContext context) {
    if (rows.isEmpty) return const EmptyState(message: 'No petty cash entries');
    return Card(
      child: ListView.separated(
        shrinkWrap: true,
        physics: const NeverScrollableScrollPhysics(),
        itemCount: rows.length,
        separatorBuilder: (_, __) => const Divider(height: 1),
        itemBuilder: (_, index) {
          final row = rows[index];
          final isIn = _text(row, ['transaction_type']) == 'CASH_IN';
          return ListTile(
            leading: Icon(
              isIn ? Icons.arrow_downward : Icons.arrow_upward,
              color: isIn ? AppColors.kSuccess : AppColors.kError,
            ),
            title: Text('${_money(row['amount'])} - ${_text(row, [
                  'purpose_category'
                ])}'),
            subtitle: Text(
              '${_text(row, [
                    'purpose_description'
                  ])} ${_date(row['transaction_date'] ?? row['created_at'])}',
            ),
            trailing: Text(_text(row, ['receipt_number'])),
          );
        },
      ),
    );
  }
}

class _StationStats extends StatelessWidget {
  const _StationStats({required this.shift});

  final Map<String, dynamic> shift;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: StatCard(
            label: 'Cash Sales',
            value: _money(shift['cash_sales']),
            icon: Icons.payments,
            color: AppColors.kSuccess,
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: StatCard(
            label: 'M-Pesa Sales',
            value: _money(shift['mpesa_sales']),
            icon: Icons.phone_android,
            color: AppColors.kPrimary,
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: StatCard(
            label: 'Card Sales',
            value: _money(shift['card_sales']),
            icon: Icons.credit_card,
            color: AppColors.kAccent,
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: StatCard(
            label: 'Total Sales',
            value: _money(shift['total_sales']),
            icon: Icons.trending_up,
            color: AppColors.kPrimary,
          ),
        ),
      ],
    );
  }
}

class _InfoGrid extends StatelessWidget {
  const _InfoGrid({required this.values});

  final Map<String, String> values;

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: 12,
      runSpacing: 12,
      children: values.entries
          .map(
            (entry) => Container(
              width: 170,
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: AppColors.kSurface,
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: AppColors.kDivider),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    entry.key,
                    style: const TextStyle(
                      fontSize: 11,
                      color: AppColors.kTextSecondary,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    entry.value.isEmpty ? '-' : entry.value,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(fontWeight: FontWeight.bold),
                  ),
                ],
              ),
            ),
          )
          .toList(),
    );
  }
}

class _KeyValueRow extends StatelessWidget {
  const _KeyValueRow({
    required this.label,
    required this.value,
    this.prominent = false,
  });

  final String label;
  final String value;
  final bool prominent;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            label,
            style: TextStyle(
              color:
                  prominent ? AppColors.kTextPrimary : AppColors.kTextSecondary,
              fontWeight: prominent ? FontWeight.bold : FontWeight.normal,
            ),
          ),
          Text(
            value,
            style: TextStyle(
              fontWeight: FontWeight.bold,
              fontSize: prominent ? 18 : 14,
              color: prominent ? AppColors.kPrimary : AppColors.kTextPrimary,
            ),
          ),
        ],
      ),
    );
  }
}

class _StationTab {
  const _StationTab(this.label, this.icon);
  final String label;
  final IconData icon;
}

class _TabStrip extends StatelessWidget {
  const _TabStrip({
    required this.tabs,
    required this.selected,
    required this.onChanged,
  });

  final List<_StationTab> tabs;
  final int selected;
  final ValueChanged<int> onChanged;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        border: Border(bottom: BorderSide(color: AppColors.kDivider)),
      ),
      child: Wrap(
        spacing: 18,
        children: [
          for (var i = 0; i < tabs.length; i++)
            InkWell(
              onTap: () => onChanged(i),
              child: Container(
                padding: const EdgeInsets.only(bottom: 12),
                decoration: BoxDecoration(
                  border: Border(
                    bottom: BorderSide(
                      color: selected == i
                          ? AppColors.kPrimary
                          : Colors.transparent,
                      width: 2,
                    ),
                  ),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(
                      tabs[i].icon,
                      size: 16,
                      color: selected == i
                          ? AppColors.kPrimary
                          : AppColors.kTextSecondary,
                    ),
                    const SizedBox(width: 6),
                    Text(
                      tabs[i].label,
                      style: TextStyle(
                        color: selected == i
                            ? AppColors.kPrimary
                            : AppColors.kTextSecondary,
                        fontWeight:
                            selected == i ? FontWeight.bold : FontWeight.w500,
                      ),
                    ),
                  ],
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class _KyogongNavItem {
  const _KyogongNavItem(this.section, this.label, this.icon);
  final KyogongSection section;
  final String label;
  final IconData icon;
}

final _kyogongNavItems = [
  _KyogongNavItem(
      KyogongSection.reception, 'Reception POS', PhosphorIcons.building()),
  _KyogongNavItem(KyogongSection.spa, 'Spa POS', PhosphorIcons.sparkle()),
  _KyogongNavItem(
      KyogongSection.executiveBar, 'Executive Bar', PhosphorIcons.wine()),
  _KyogongNavItem(KyogongSection.sportsBar, 'Sports Bar', PhosphorIcons.wine()),
  _KyogongNavItem(
      KyogongSection.transactions, 'Transactions', PhosphorIcons.receipt()),
  _KyogongNavItem(KyogongSection.shifts, 'Shifts', PhosphorIcons.clock()),
  _KyogongNavItem(KyogongSection.services, 'Services', PhosphorIcons.tag()),
  _KyogongNavItem(
      KyogongSection.pettyCash, 'Petty Cash', PhosphorIcons.wallet()),
  _KyogongNavItem(KyogongSection.float, 'Float', PhosphorIcons.coins()),
];

class _KyogongSideNav extends ConsumerWidget {
  const _KyogongSideNav({
    required this.width,
    required this.isCollapsed,
    required this.current,
    required this.onChanged,
  });

  final double width;
  final bool isCollapsed;
  final KyogongSection current;
  final ValueChanged<KyogongSection> onChanged;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Container(
      width: width,
      color: Colors.white,
      child: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(24),
            child: isCollapsed
                ? _LogoBox()
                : Row(
                    children: [
                      _LogoBox(),
                      const SizedBox(width: 12),
                      const Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'Kyogong',
                              style: TextStyle(
                                fontWeight: FontWeight.bold,
                                fontSize: 16,
                              ),
                            ),
                            Text(
                              'Famous Gates',
                              style: TextStyle(
                                fontSize: 12,
                                color: Colors.grey,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
          ),
          const Divider(height: 1),
          Expanded(
            child: ListView(
              padding: const EdgeInsets.symmetric(vertical: 12),
              children: [
                for (final item in _kyogongNavItems)
                  _NavTile(
                    item: item,
                    isCollapsed: isCollapsed,
                    active: item.section == current,
                    onTap: () => onChanged(item.section),
                  ),
              ],
            ),
          ),
          const Divider(height: 1),
          Padding(
            padding: const EdgeInsets.all(16),
            child: isCollapsed
                ? IconButton(
                    onPressed: () =>
                        ref.read(authNotifierProvider.notifier).logout(),
                    icon: Icon(PhosphorIcons.signOut(),
                        color: Colors.grey.shade600),
                    tooltip: 'Logout',
                  )
                : OutlinedButton.icon(
                    onPressed: () =>
                        ref.read(authNotifierProvider.notifier).logout(),
                    icon: Icon(PhosphorIcons.signOut(), size: 18),
                    label: const Text('Logout'),
                    style: OutlinedButton.styleFrom(
                      minimumSize: const Size(double.infinity, 44),
                    ),
                  ),
          ),
        ],
      ),
    );
  }
}

class _KyogongTopBar extends ConsumerWidget {
  const _KyogongTopBar({required this.section, this.onMenuTap});

  final KyogongSection section;
  final VoidCallback? onMenuTap;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(authNotifierProvider).valueOrNull;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border(bottom: BorderSide(color: Colors.grey.shade200)),
      ),
      child: Row(
        children: [
          if (onMenuTap != null) ...[
            IconButton(
                onPressed: onMenuTap, icon: Icon(PhosphorIcons.listBullets())),
            const SizedBox(width: 16),
          ],
          Text('Kyogong',
              style: TextStyle(fontSize: 14, color: Colors.grey.shade500)),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 8),
            child: Icon(Icons.chevron_right,
                size: 14, color: Colors.grey.shade400),
          ),
          Text(
            _sectionLabel(section),
            style: TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w600,
              color: Colors.grey.shade700,
            ),
          ),
          const Spacer(),
          Container(
            width: 280,
            height: 40,
            decoration: BoxDecoration(
              color: Colors.grey.shade50,
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: Colors.grey.shade200),
            ),
            child: TextField(
              decoration: InputDecoration(
                hintText: 'Search...',
                hintStyle: TextStyle(fontSize: 14, color: Colors.grey.shade400),
                prefixIcon: Icon(PhosphorIcons.magnifyingGlass(),
                    size: 18, color: Colors.grey.shade400),
                border: InputBorder.none,
                contentPadding:
                    const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              ),
            ),
          ),
          const SizedBox(width: 16),
          IconButton(
            onPressed: () => AppNotifier.showSnackBar(
              context,
              const SnackBar(content: Text('No new notifications')),
            ),
            icon: Icon(PhosphorIcons.bell(), color: Colors.grey.shade700),
          ),
          const SizedBox(width: 16),
          CircleAvatar(
            radius: 16,
            backgroundColor: AppColors.kPrimary.withValues(alpha: 0.1),
            child: Text(
              (user?.name.isNotEmpty == true ? user!.name[0] : 'K')
                  .toUpperCase(),
              style: const TextStyle(
                color: AppColors.kPrimary,
                fontWeight: FontWeight.bold,
                fontSize: 12,
              ),
            ),
          ),
          const SizedBox(width: 8),
          Text(
            user?.name.split(' ').first ?? 'Cashier',
            style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13),
          ),
        ],
      ),
    );
  }
}

class _KyogongMobileNav extends StatelessWidget {
  const _KyogongMobileNav({
    required this.current,
    required this.onChanged,
  });

  final KyogongSection current;
  final ValueChanged<KyogongSection> onChanged;

  @override
  Widget build(BuildContext context) {
    return Container(
      height: MediaQuery.of(context).size.height * 0.7,
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          for (final item in _kyogongNavItems)
            ListTile(
              leading: Icon(item.icon,
                  color: item.section == current
                      ? AppColors.kPrimary
                      : AppColors.kTextSecondary),
              title: Text(item.label),
              selected: item.section == current,
              onTap: () => onChanged(item.section),
            ),
        ],
      ),
    );
  }
}

class _KyogongBottomNav extends StatelessWidget {
  const _KyogongBottomNav({
    required this.current,
    required this.onChanged,
  });

  final KyogongSection current;
  final ValueChanged<KyogongSection> onChanged;

  @override
  Widget build(BuildContext context) {
    final items = _kyogongNavItems.take(4).toList();
    return BottomNavigationBar(
      currentIndex:
          items.indexWhere((item) => item.section == current).clamp(0, 3),
      selectedItemColor: AppColors.kPrimary,
      unselectedItemColor: AppColors.kTextSecondary,
      onTap: (index) => onChanged(items[index].section),
      items: [
        for (final item in items)
          BottomNavigationBarItem(icon: Icon(item.icon), label: item.label),
      ],
    );
  }
}

class _LogoBox extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Container(
      width: 40,
      height: 40,
      decoration: const BoxDecoration(
        color: AppColors.kPrimary,
        borderRadius: BorderRadius.all(Radius.circular(10)),
      ),
      child: const Center(
        child: Text(
          'K',
          style: TextStyle(
            color: Colors.white,
            fontWeight: FontWeight.bold,
            fontSize: 20,
          ),
        ),
      ),
    );
  }
}

class _NavTile extends StatelessWidget {
  const _NavTile({
    required this.item,
    required this.isCollapsed,
    required this.active,
    required this.onTap,
  });

  final _KyogongNavItem item;
  final bool isCollapsed;
  final bool active;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    if (isCollapsed) {
      return Tooltip(
        message: item.label,
        child: Container(
          margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
          child: IconButton(
            onPressed: onTap,
            icon: Icon(item.icon),
            color: active ? AppColors.kPrimary : AppColors.kTextSecondary,
            style: IconButton.styleFrom(
              backgroundColor:
                  active ? AppColors.kPrimary.withValues(alpha: 0.1) : null,
            ),
          ),
        ),
      );
    }
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
      child: ListTile(
        onTap: onTap,
        leading: Icon(item.icon,
            color: active ? AppColors.kPrimary : AppColors.kTextSecondary),
        title: Text(
          item.label,
          style: TextStyle(
            fontSize: 14,
            fontWeight: active ? FontWeight.w600 : FontWeight.normal,
            color: active ? AppColors.kPrimary : AppColors.kTextSecondary,
          ),
        ),
        selected: active,
        selectedTileColor: AppColors.kPrimary.withValues(alpha: 0.08),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
        contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
      ),
    );
  }
}

Future<num?> _cashPaymentDialog(BuildContext context, num total) {
  final controller = TextEditingController(text: total.toStringAsFixed(0));
  return showDialog<num>(
    context: context,
    builder: (context) {
      return StatefulBuilder(
        builder: (context, setState) {
          final received = num.tryParse(controller.text.trim()) ?? 0;
          final change = (received - total).clamp(0, double.infinity);
          return AlertDialog(
            title: const Text('Cash Payment'),
            content: SizedBox(
              width: 420,
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  _InfoGrid(values: {
                    'Bill Total': _money(total),
                    'Cash Received': _money(received),
                    'Change': _money(change),
                  }),
                  const SizedBox(height: 12),
                  TextField(
                    controller: controller,
                    autofocus: true,
                    keyboardType: TextInputType.number,
                    onChanged: (_) => setState(() {}),
                    decoration: const InputDecoration(
                      labelText: 'Cash received',
                      prefixText: 'KES ',
                    ),
                  ),
                  const SizedBox(height: 8),
                  Wrap(
                    spacing: 8,
                    children: [
                      for (final amount in {
                        total,
                        (total / 100).ceil() * 100,
                        (total / 500).ceil() * 500,
                        (total / 1000).ceil() * 1000,
                      })
                        OutlinedButton(
                          onPressed: () {
                            controller.text = amount.toStringAsFixed(0);
                            setState(() {});
                          },
                          child: Text(amount.toStringAsFixed(0)),
                        ),
                    ],
                  ),
                ],
              ),
            ),
            actions: [
              TextButton(
                  onPressed: () => Navigator.pop(context),
                  child: const Text('Cancel')),
              ElevatedButton(
                onPressed: received >= total
                    ? () => Navigator.pop(context, received)
                    : null,
                child: const Text('Confirm'),
              ),
            ],
          );
        },
      );
    },
  ).whenComplete(controller.dispose);
}

Future<Map<String, dynamic>?> _pettyCashDialog(
    BuildContext context, String? shiftId) {
  final amount = TextEditingController();
  final description = TextEditingController();
  final paidTo = TextEditingController();
  final receipt = TextEditingController();
  final authorizer = TextEditingController();
  String txType = 'CASH_OUT';
  String category = 'REPAIRS';
  return showDialog<Map<String, dynamic>>(
    context: context,
    builder: (context) => StatefulBuilder(
      builder: (context, setState) => AlertDialog(
        title: const Text('Record Petty Cash'),
        content: SizedBox(
          width: 460,
          child: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                SegmentedButton<String>(
                  segments: const [
                    ButtonSegment(value: 'CASH_OUT', label: Text('Cash Out')),
                    ButtonSegment(value: 'CASH_IN', label: Text('Cash In')),
                  ],
                  selected: {txType},
                  onSelectionChanged: (value) =>
                      setState(() => txType = value.first),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: amount,
                  keyboardType: TextInputType.number,
                  decoration: const InputDecoration(labelText: 'Amount'),
                ),
                const SizedBox(height: 12),
                DropdownButtonFormField<String>(
                  initialValue: category,
                  decoration: const InputDecoration(labelText: 'Category'),
                  items: const [
                    DropdownMenuItem(value: 'REPAIRS', child: Text('Repairs')),
                    DropdownMenuItem(
                        value: 'MAINTENANCE', child: Text('Maintenance')),
                    DropdownMenuItem(value: 'FUEL', child: Text('Fuel')),
                    DropdownMenuItem(
                        value: 'TRANSPORT', child: Text('Staff Transport')),
                    DropdownMenuItem(
                        value: 'SUPPLIES', child: Text('Supplies')),
                    DropdownMenuItem(value: 'OTHER', child: Text('Other')),
                  ],
                  onChanged: (value) =>
                      setState(() => category = value ?? category),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: description,
                  decoration: const InputDecoration(labelText: 'Description'),
                ),
                if (txType == 'CASH_OUT') ...[
                  const SizedBox(height: 12),
                  TextField(
                    controller: paidTo,
                    decoration: const InputDecoration(labelText: 'Paid To'),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: authorizer,
                    decoration:
                        const InputDecoration(labelText: 'Authorized By'),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: receipt,
                    decoration: const InputDecoration(labelText: 'Receipt No.'),
                  ),
                ],
              ],
            ),
          ),
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('Cancel')),
          ElevatedButton(
            onPressed: () => Navigator.pop(context, {
              if (shiftId != null) 'shift_id': shiftId,
              'transaction_type': txType,
              'amount': num.tryParse(amount.text.trim()) ?? 0,
              'purpose_category': category,
              'purpose_description': description.text.trim(),
              if (paidTo.text.trim().isNotEmpty)
                'paid_to_name': paidTo.text.trim(),
              if (authorizer.text.trim().isNotEmpty)
                'authorizer_name': authorizer.text.trim(),
              if (receipt.text.trim().isNotEmpty)
                'receipt_number': receipt.text.trim(),
            }),
            child: const Text('Record'),
          ),
        ],
      ),
    ),
  ).whenComplete(() {
    amount.dispose();
    description.dispose();
    paidTo.dispose();
    receipt.dispose();
    authorizer.dispose();
  });
}

Future<Map<String, dynamic>?> _serviceDialog(BuildContext context,
    {Map<String, dynamic>? row}) {
  final name = TextEditingController(text: _text(row ?? {}, ['name']));
  final price = TextEditingController(
      text: _num(row?['base_price'] ?? row?['price']).toStringAsFixed(0));
  final hourly = TextEditingController(
      text: _num(row?['price_per_hour']).toStringAsFixed(0));
  String type = _text(row ?? {}, ['service_type']).isEmpty
      ? 'spa'
      : _text(row ?? {}, ['service_type']);
  String model = _text(row ?? {}, ['pricing_model']).isEmpty
      ? 'fixed'
      : _text(row ?? {}, ['pricing_model']);
  return showDialog<Map<String, dynamic>>(
    context: context,
    builder: (context) => StatefulBuilder(
      builder: (context, setState) => AlertDialog(
        title: Text(row == null ? 'Create Service' : 'Edit Service'),
        content: SizedBox(
          width: 420,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                controller: name,
                decoration: const InputDecoration(labelText: 'Name'),
              ),
              const SizedBox(height: 12),
              DropdownButtonFormField<String>(
                initialValue: type,
                decoration: const InputDecoration(labelText: 'Service Type'),
                items: const [
                  DropdownMenuItem(value: 'car_wash', child: Text('Car Wash')),
                  DropdownMenuItem(value: 'spa', child: Text('Spa')),
                  DropdownMenuItem(value: 'bar', child: Text('Bar')),
                  DropdownMenuItem(value: 'pool', child: Text('Pool')),
                ],
                onChanged: (value) => setState(() => type = value ?? type),
              ),
              const SizedBox(height: 12),
              DropdownButtonFormField<String>(
                initialValue: model,
                decoration: const InputDecoration(labelText: 'Pricing Model'),
                items: const [
                  DropdownMenuItem(value: 'fixed', child: Text('Fixed')),
                  DropdownMenuItem(value: 'hourly', child: Text('Hourly')),
                ],
                onChanged: (value) => setState(() => model = value ?? model),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: price,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(labelText: 'Base Price'),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: hourly,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(labelText: 'Price Per Hour'),
              ),
            ],
          ),
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('Cancel')),
          ElevatedButton(
            onPressed: () => Navigator.pop(context, {
              'service_type': type,
              'name': name.text.trim(),
              'pricing_model': model,
              'base_price': num.tryParse(price.text.trim()) ?? 0,
              'price_per_hour': num.tryParse(hourly.text.trim()) ?? 0,
              'is_active': true,
            }),
            child: const Text('Save'),
          ),
        ],
      ),
    ),
  ).whenComplete(() {
    name.dispose();
    price.dispose();
    hourly.dispose();
  });
}

Future<String?> _textDialog(BuildContext context, String title, String label) {
  final controller = TextEditingController();
  return showDialog<String>(
    context: context,
    builder: (context) => AlertDialog(
      title: Text(title),
      content: TextField(
        controller: controller,
        maxLines: 3,
        decoration: InputDecoration(labelText: label),
      ),
      actions: [
        TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancel')),
        ElevatedButton(
          onPressed: () => Navigator.pop(context, controller.text.trim()),
          child: const Text('Save'),
        ),
      ],
    ),
  ).whenComplete(controller.dispose);
}

Map<String, dynamic>? _payloadOrNull(Map<String, dynamic> data) {
  final value = data['data'];
  if (value == null) return null;
  if (value is Map<String, dynamic>) return value;
  if (value is Map) return Map<String, dynamic>.from(value);
  return data.isEmpty ? null : data;
}

Map<String, dynamic> _asMap(dynamic value) {
  if (value is Map<String, dynamic>) return value;
  if (value is Map) return Map<String, dynamic>.from(value);
  return {};
}

List<Map<String, dynamic>> _list(dynamic value) {
  if (value is List) {
    return value
        .whereType<Map>()
        .map((item) => Map<String, dynamic>.from(item))
        .toList();
  }
  return const [];
}

String _text(Map<String, dynamic> row, List<String> keys) {
  for (final key in keys) {
    final value = row[key];
    if (value != null && value.toString().trim().isNotEmpty) {
      return value.toString();
    }
  }
  return '';
}

num _num(dynamic value) {
  if (value is num) return value;
  return num.tryParse(value?.toString() ?? '') ?? 0;
}

String _money(dynamic value) {
  return NumberFormat.currency(symbol: 'KES ', decimalDigits: 0)
      .format(_num(value));
}

String _date(dynamic value) {
  if (value == null || value.toString().isEmpty) return '-';
  final parsed = DateTime.tryParse(value.toString());
  if (parsed == null) return value.toString();
  return DateFormat('MMM d, yyyy HH:mm').format(parsed.toLocal());
}

Color _paymentColor(String method) {
  switch (method.toUpperCase()) {
    case 'MPESA':
      return AppColors.kSuccess;
    case 'CARD':
      return AppColors.kAccent;
    case 'BILL':
      return AppColors.kWarning;
    default:
      return AppColors.kPrimary;
  }
}

Color _statusColor(String status) {
  switch (status.toUpperCase()) {
    case 'OPEN':
      return AppColors.kPrimary;
    case 'CLOSED':
    case 'RECONCILED':
    case 'APPROVED':
      return AppColors.kSuccess;
    case 'FLAGGED':
    case 'REJECTED':
      return AppColors.kError;
    default:
      return AppColors.kWarning;
  }
}

String _sectionLabel(KyogongSection section) {
  return _kyogongNavItems.firstWhere((item) => item.section == section).label;
}
