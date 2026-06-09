import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:printing/printing.dart';

import '../../../core/theme/app_theme.dart';
import '../../../core/utils/api_error_message.dart';
import '../../../core/utils/readable_record.dart';
import '../../../core/widgets/widgets.dart';
import '../../../services/print_service.dart';
import '../../pos/domain/models.dart';
import '../data/cashier_repository.dart';
import '../domain/providers.dart';

enum CashierTab { station, pos, bills, credit, shifts, barcode, insights }

class CashierDashboard extends ConsumerStatefulWidget {
  const CashierDashboard({
    super.key,
    this.initialTab = CashierTab.station,
    this.initialBillRef,
    this.initialAmount,
    this.initialMethod,
  });

  final CashierTab initialTab;

  /// Optional pre-fill when navigated from another module (e.g. reception
  /// checkout): bill reference to auto-load, amount, and payment method.
  final String? initialBillRef;
  final String? initialAmount;
  final String? initialMethod;

  @override
  ConsumerState<CashierDashboard> createState() => _CashierDashboardState();
}

class _CashierDashboardState extends ConsumerState<CashierDashboard> {
  static const _visibleTabs = [
    CashierTab.station,
    CashierTab.bills,
    CashierTab.shifts,
    CashierTab.barcode,
    CashierTab.insights,
  ];

  late int _tab = () {
    final index = _visibleTabs.indexOf(widget.initialTab);
    return index >= 0 ? index : 0;
  }();

  @override
  Widget build(BuildContext context) {
    final tabs = [
      DashboardTab(
        label: 'Station',
        icon: Icons.point_of_sale,
        content: _RequiresOpenShift(
            child: _StationTab(
          initialBillRef: widget.initialBillRef,
          initialAmount: widget.initialAmount,
          initialMethod: widget.initialMethod,
        )),
      ),
      const DashboardTab(
        label: 'Unpaid Bills',
        icon: Icons.receipt_long,
        content: _RequiresOpenShift(child: _UnpaidBillsTab()),
      ),
      const DashboardTab(
        label: 'Shifts',
        icon: Icons.access_time,
        content: _ShiftsTab(),
      ),
      const DashboardTab(
        label: 'Barcode',
        icon: Icons.qr_code_scanner,
        content: _BarcodeTab(),
      ),
      const DashboardTab(
        label: 'Insights',
        icon: Icons.insights,
        content: _InsightsTab(),
      ),
    ];

    return DashboardShell(
      title: 'Cashier Desk',
      currentTab: _tab,
      onTabChanged: (index) => setState(() => _tab = index),
      tabs: tabs,
      actions: [
        OutlinedButton.icon(
          onPressed: () {
            ref.invalidate(cashierStatsProvider);
            ref.invalidate(cashierReconciliationProvider);
          },
          icon: const Icon(Icons.refresh, size: 16),
          label: const Text('Refresh'),
        ),
      ],
    );
  }
}

class _RequiresOpenShift extends ConsumerWidget {
  const _RequiresOpenShift({required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final openShift = ref.watch(
        cashierShiftsProvider(const CashierShiftFilters(status: 'open')));

    return openShift.when(
      data: (rows) {
        if (rows.any((row) => _shiftStatus(row) == 'open')) return child;
        return Padding(
          padding: const EdgeInsets.all(24),
          child: Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 560),
              child: Card(
                child: Padding(
                  padding: const EdgeInsets.all(28),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      CircleAvatar(
                        radius: 30,
                        backgroundColor:
                            AppColors.kWarning.withValues(alpha: 0.12),
                        child: const Icon(Icons.lock_clock,
                            color: AppColors.kWarning, size: 30),
                      ),
                      const SizedBox(height: 16),
                      Text(
                        'Open shift required',
                        style: Theme.of(context).textTheme.titleLarge,
                        textAlign: TextAlign.center,
                      ),
                      const SizedBox(height: 8),
                      const Text(
                        'Request a cashier shift opening from the Shifts tab. A branch accountant must approve it before cashier operations can begin.',
                        textAlign: TextAlign.center,
                        style: TextStyle(color: AppColors.kTextSecondary),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        );
      },
      loading: () => const Padding(
        padding: EdgeInsets.all(24),
        child: LoadingSkeleton(type: SkeletonType.list),
      ),
      error: (error, _) => Padding(
        padding: const EdgeInsets.all(24),
        child: ErrorState(message: apiErrorMessage(error)),
      ),
    );
  }
}

class _StationTab extends ConsumerStatefulWidget {
  const _StationTab({this.initialBillRef, this.initialAmount, this.initialMethod});

  final String? initialBillRef;
  final String? initialAmount;
  final String? initialMethod;

  @override
  ConsumerState<_StationTab> createState() => _StationTabState();
}

class _StationTabState extends ConsumerState<_StationTab> {
  final _lookupController = TextEditingController();
  final _amountController = TextEditingController();
  final _referenceController = TextEditingController();
  final _mpesaPhoneController = TextEditingController();
  String _method = 'cash';
  bool _loading = false;
  Map<String, dynamic>? _bill;
  List<Map<String, dynamic>> _mpesaMatches = const [];

  @override
  void initState() {
    super.initState();
    final method = widget.initialMethod;
    if (method != null && method.isNotEmpty) {
      // Normalise reception methods (mpesa/card) to station methods.
      _method = method == 'mpesa'
          ? 'mpesa_manual'
          : method == 'card'
              ? 'card_manual'
              : method;
    }
    final amount = widget.initialAmount;
    if (amount != null && amount.isNotEmpty) {
      _amountController.text = amount;
    }
    final ref0 = widget.initialBillRef;
    if (ref0 != null && ref0.isNotEmpty) {
      _lookupController.text = ref0;
      WidgetsBinding.instance
          .addPostFrameCallback((_) => _lookupBill(keepAmount: true));
    }
  }

  @override
  void dispose() {
    _lookupController.dispose();
    _amountController.dispose();
    _referenceController.dispose();
    _mpesaPhoneController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final stats = ref.watch(cashierStatsProvider);
    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          stats.when(
            data: (data) {
              final s = _payload(data);
              return Row(
                children: [
                  Expanded(
                    child: StatCard(
                      label: 'Today Collections',
                      value: _money(s['todayRevenue'] ??
                          s['today_collections'] ??
                          s['total_collections'] ??
                          s['total_sales']),
                      icon: Icons.payments,
                      color: AppColors.kSuccess,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: StatCard(
                      label: 'Pending Bills',
                      value: '${s['pendingCreditApprovals'] ?? s['unpaidBills'] ?? s['pending_verification'] ?? s['pending'] ?? 0}',
                      icon: Icons.verified,
                      color: AppColors.kWarning,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: StatCard(
                      label: 'Open Shifts',
                      value: '${_openShiftCount(s)}',
                      icon: Icons.access_time,
                      color: AppColors.kPrimary,
                    ),
                  ),
                ],
              );
            },
            loading: () => const LoadingSkeleton(type: SkeletonType.card),
            error: (_, __) => const SizedBox.shrink(),
          ),
          const SizedBox(height: 20),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(flex: 2, child: _lookupPanel()),
              const SizedBox(width: 16),
              Expanded(child: _paymentPanel()),
            ],
          ),
          if (_mpesaMatches.isNotEmpty) ...[
            const SizedBox(height: 16),
            _MpesaMatches(
              matches: _mpesaMatches,
              onUse: (match) {
                setState(() {
                  _referenceController.text = _text(match,
                      ['receipt_number', 'mpesa_receipt_number', 'reference']);
                  _method = 'mpesa_manual';
                });
              },
            ),
          ],
        ],
      ),
    );
  }

  Widget _lookupPanel() {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Bill Lookup',
              style: Theme.of(context).textTheme.titleMedium,
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _lookupController,
              onSubmitted: (_) => _lookupBill(),
              decoration: const InputDecoration(
                labelText:
                    'Order number, short code, barcode, invoice, booking, POS ref',
                prefixIcon: Icon(Icons.search),
              ),
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                ElevatedButton.icon(
                  onPressed: _loading ? null : _lookupBill,
                  icon: const Icon(Icons.search, size: 16),
                  label: const Text('Lookup'),
                ),
                const SizedBox(width: 8),
                OutlinedButton(
                  onPressed: () {
                    setState(() {
                      _bill = null;
                      _lookupController.clear();
                      _amountController.clear();
                      _referenceController.clear();
                      _mpesaMatches = const [];
                    });
                  },
                  child: const Text('Clear'),
                ),
              ],
            ),
            const SizedBox(height: 20),
            if (_loading)
              const LoadingSkeleton(type: SkeletonType.list)
            else if (_bill == null)
              const EmptyState(message: 'No bill loaded')
            else
              _BillSummary(
                bill: _bill!,
                onCopyReference: () {
                  Clipboard.setData(
                      ClipboardData(text: _lookupController.text));
                  _snack('Bill reference copied');
                },
              ),
          ],
        ),
      ),
    );
  }

  Widget _paymentPanel() {
    final balance = _balanceFromBill(_bill);
    if (_bill != null && _amountController.text.isEmpty) {
      _amountController.text = balance.toStringAsFixed(0);
    }
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Process Payment',
                style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 12),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                _methodChip('cash', 'Cash', Icons.money),
                _methodChip('mpesa_manual', 'M-Pesa', Icons.phone_android),
                _methodChip('card_manual', 'Card', Icons.credit_card),
                _methodChip('credit_bill', 'Credit Bill', Icons.badge),
              ],
            ),
            const SizedBox(height: 16),
            TextField(
              controller: _amountController,
              keyboardType: TextInputType.number,
              decoration: InputDecoration(
                labelText: 'Amount',
                helperText:
                    _bill == null ? null : 'Balance: ${_money(balance)}',
              ),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _referenceController,
              decoration: InputDecoration(
                labelText:
                    _method == 'cash' ? 'Reference (optional)' : 'Reference',
              ),
            ),
            if (_method == 'mpesa_manual') ...[
              const SizedBox(height: 12),
              TextField(
                controller: _mpesaPhoneController,
                keyboardType: TextInputType.phone,
                decoration:
                    const InputDecoration(labelText: 'M-Pesa phone search/STK'),
              ),
              const SizedBox(height: 8),
              Row(
                children: [
                  OutlinedButton.icon(
                    onPressed: _loading ? null : _searchMpesa,
                    icon: const Icon(Icons.manage_search, size: 16),
                    label: const Text('Search Payments'),
                  ),
                  const SizedBox(width: 8),
                  OutlinedButton.icon(
                    onPressed: _loading ? null : _initiateMpesa,
                    icon: const Icon(Icons.send_to_mobile, size: 16),
                    label: const Text('STK Push'),
                  ),
                ],
              ),
            ],
            const SizedBox(height: 16),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed:
                        _bill == null || _loading ? null : _processSplitPayment,
                    icon: const Icon(Icons.call_split, size: 16),
                    label: const Text('Split Payment'),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: ElevatedButton.icon(
                    onPressed:
                        _bill == null || _loading ? null : _processPayment,
                    icon: const Icon(Icons.check_circle, size: 16),
                    label: const Text('Process'),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _methodChip(String value, String label, IconData icon) {
    return ChoiceChip(
      selected: _method == value,
      avatar: Icon(icon, size: 16),
      label: Text(label),
      onSelected: (_) => setState(() => _method = value),
    );
  }

  Future<void> _lookupBill({bool keepAmount = false}) async {
    final id = _lookupController.text.trim();
    if (id.isEmpty) return _snack('Enter a bill reference');
    setState(() => _loading = true);
    try {
      final bill = await ref.read(cashierRepositoryProvider).getBillDetails(id);
      final data = _payload(bill);
      setState(() {
        _bill = data;
        // Keep an explicitly pre-entered amount (e.g. reception checkout);
        // otherwise default to the bill balance.
        if (!keepAmount || _amountController.text.trim().isEmpty) {
          _amountController.text = _balanceFromBill(data).toStringAsFixed(0);
        }
      });
    } catch (error) {
      _snack('Bill lookup failed: ${apiErrorMessage(error)}');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _processPayment() async {
    final bill = _bill;
    if (bill == null) return;
    final amount = num.tryParse(_amountController.text.trim()) ?? 0;
    if (amount <= 0) return _snack('Enter a valid amount');

    Map<String, dynamic>? creditBill;
    if (_method == 'credit_bill') {
      final staff = await ref
          .read(cashierRepositoryProvider)
          .getBranchStaff()
          .catchError((_) => <Map<String, dynamic>>[]);
      if (!mounted) return;
      creditBill =
          await _creditBillPayload(context, amount, staffMembers: staff);
      if (creditBill == null) return;
    }

    setState(() => _loading = true);
    try {
      Map<String, dynamic>? createdCredit;
      Map<String, dynamic>? paymentCreditBill = creditBill;
      if (creditBill != null) {
        createdCredit = await ref
            .read(cashierRepositoryProvider)
            .createCreditBill(creditBill);
        final createdCreditData = _payload(createdCredit);
        paymentCreditBill = {
          ...creditBill,
          if (_text(createdCreditData, ['id']).isNotEmpty)
            'id': _text(createdCreditData, ['id']),
          if (_text(createdCreditData, ['staff_credit_bill_id']).isNotEmpty)
            'staff_credit_bill_id':
                _text(createdCreditData, ['staff_credit_bill_id']),
          if (_text(createdCreditData, ['credit_number']).isNotEmpty)
            'credit_number': _text(createdCreditData, ['credit_number']),
        };
      }
      final paymentResponse =
          await ref.read(cashierRepositoryProvider).processPayment(
                bookingId: _lookupController.text.trim(),
                amount: amount,
                method: _backendPaymentMethod(_method),
                reference: createdCredit == null
                    ? _referenceController.text.trim()
                    : _text(_payload(createdCredit), ['credit_number', 'id']),
                creditBill: paymentCreditBill,
              );
      await _printStationReceipt(
        bill: bill,
        amount: amount,
        method: _method,
        response: paymentResponse,
        fallbackReference: createdCredit == null
            ? _referenceController.text.trim()
            : _text(_payload(createdCredit), ['credit_number', 'id']),
      );
      _snack('Payment recorded');
      ref.invalidate(cashierStatsProvider);
      ref.invalidate(cashierUnpaidBillsProvider);
      ref.invalidate(cashierCreditBillsProvider);
      await _lookupBill();
    } catch (error) {
      _snack('Payment failed: ${apiErrorMessage(error)}');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _processSplitPayment() async {
    final bill = _bill;
    if (bill == null) return;
    final balance = _balanceFromBill(bill);
    if (balance <= 0) return _snack('This bill has no balance to clear');

    final body = await _paymentPayload(
      context,
      balance,
      title: 'Split Payment',
    );
    if (body == null) return;
    final payments = _paymentLinesFromPayload(body);
    if (payments.isEmpty) return _snack('Add at least one payment line');

    final totalPaid = payments.fold<num>(
      0,
      (sum, payment) => sum + _num(payment['payment_amount']),
    );
    if (totalPaid <= 0) return _snack('Enter a valid payment amount');

    setState(() => _loading = true);
    try {
      final responses = <Map<String, dynamic>>[];
      final receiptRefs = <String>[];

      for (final payment in payments) {
        final amount = _num(payment['payment_amount']);
        final method = _backendPaymentMethod(
            _text(payment, ['payment_method']).isEmpty
                ? 'cash'
                : _text(payment, ['payment_method']));
        var reference = _text(payment, ['payment_reference']);
        Map<String, dynamic>? paymentCreditBill;

        if (method == 'credit_bill') {
          final staff = await ref
              .read(cashierRepositoryProvider)
              .getBranchStaff()
              .catchError((_) => <Map<String, dynamic>>[]);
          if (!mounted) return;
          final creditBill =
              await _creditBillPayload(context, amount, staffMembers: staff);
          if (creditBill == null) return;
          final createdCredit = await ref
              .read(cashierRepositoryProvider)
              .createCreditBill(creditBill);
          final createdCreditData = _payload(createdCredit);
          reference = _text(createdCreditData, ['credit_number', 'id']);
          paymentCreditBill = {
            ...creditBill,
            if (_text(createdCreditData, ['id']).isNotEmpty)
              'id': _text(createdCreditData, ['id']),
            if (_text(createdCreditData, ['staff_credit_bill_id']).isNotEmpty)
              'staff_credit_bill_id':
                  _text(createdCreditData, ['staff_credit_bill_id']),
            if (_text(createdCreditData, ['credit_number']).isNotEmpty)
              'credit_number': _text(createdCreditData, ['credit_number']),
          };
        }

        final response =
            await ref.read(cashierRepositoryProvider).processPayment(
                  bookingId: _lookupController.text.trim(),
                  amount: amount,
                  method: method,
                  reference: reference,
                  creditBill: paymentCreditBill,
                );
        responses.add(response);
        receiptRefs.add(
          '${_receiptMethodLabel(method)} ${_money(amount)}'
          '${reference.isEmpty ? '' : ' ($reference)'}',
        );
      }

      await _printStationReceipt(
        bill: bill,
        amount: totalPaid,
        method: payments.length == 1
            ? _text(payments.first, ['payment_method'])
            : 'split',
        response: responses.isEmpty ? const {} : responses.last,
        fallbackReference: receiptRefs.join(' | '),
      );
      _snack(
        totalPaid >= balance
            ? 'Split payment recorded and bill cleared'
            : 'Partial payment recorded. Remaining: ${_money(balance - totalPaid)}',
      );
      ref.invalidate(cashierStatsProvider);
      ref.invalidate(cashierUnpaidBillsProvider);
      ref.invalidate(cashierCreditBillsProvider);
      await _lookupBill();
    } catch (error) {
      _snack('Split payment failed: ${apiErrorMessage(error)}');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _searchMpesa() async {
    final amount = num.tryParse(_amountController.text.trim());
    setState(() => _loading = true);
    try {
      final matches = await ref.read(cashierRepositoryProvider).searchMpesa(
            amount: amount,
            phone: _mpesaPhoneController.text,
          );
      setState(() => _mpesaMatches = matches);
      if (matches.isEmpty) _snack('No matching M-Pesa payment found');
    } catch (error) {
      _snack('M-Pesa search failed: ${apiErrorMessage(error)}');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _printStationReceipt({
    required Map<String, dynamic> bill,
    required num amount,
    required String method,
    required Map<String, dynamic> response,
    required String fallbackReference,
  }) async {
    try {
      final payload = _payload(response);
      final data = _payload(payload['data']);
      final reference = _text(data, ['reference', 'id']).isNotEmpty
          ? _text(data, ['reference', 'id'])
          : fallbackReference;
      final receiptItems = _receiptItemsFromBill(bill, amount);
      final nav = ref.read(dashboardNavProvider);
      final methodLabel = _receiptMethodLabel(method);
      await PrintService().printReceipt(
        SaleResult(
          transactionId:
              reference.isEmpty ? DateTime.now().toString() : reference,
          createdAt: DateTime.now(),
          receiptNumber: reference.isEmpty ? null : reference,
          cashierName: nav.user?.name,
          total: amount.toDouble(),
          paymentMethod: methodLabel,
        ),
        receiptItems,
        nav.branchName,
        receiptType: '$methodLabel RECEIPT',
        customerName: _customerName(bill),
        publicCode: _lookupController.text.trim(),
      );
    } catch (error) {
      _snack('Payment recorded, but receipt failed: ${apiErrorMessage(error)}');
    }
  }

  Future<void> _initiateMpesa() async {
    final phone = _mpesaPhoneController.text.trim();
    final amount = num.tryParse(_amountController.text.trim()) ?? 0;
    if (phone.isEmpty || amount <= 0) {
      return _snack('Phone and amount required');
    }
    setState(() => _loading = true);
    try {
      final res = await ref.read(cashierRepositoryProvider).initiateMpesa(
            phone: phone,
            amount: amount,
            accountReference: _lookupController.text.trim(),
          );
      final data = _payload(res);
      _referenceController.text =
          _text(data, ['checkoutRequestId', 'CheckoutRequestID', 'reference']);
      _snack('M-Pesa STK push initiated');
    } catch (error) {
      _snack('STK push failed: ${apiErrorMessage(error)}');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  void _snack(String message) {
    if (!mounted) return;
    AppNotifier.show(context, message);
  }
}

class _PosCartTab extends ConsumerStatefulWidget {
  const _PosCartTab();

  @override
  ConsumerState<_PosCartTab> createState() => _PosCartTabState();
}

class _PosCartTabState extends ConsumerState<_PosCartTab> {
  final _customerController = TextEditingController(text: 'Walk-in Customer');
  final _phoneController = TextEditingController();
  final _catalogSearchController = TextEditingController();
  String _method = 'CASH';
  bool _saving = false;
  final List<Map<String, dynamic>> _items = [];

  @override
  void dispose() {
    _customerController.dispose();
    _phoneController.dispose();
    _catalogSearchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final catalog = ref.watch(cashierPOSItemsProvider);
    final total =
        _items.fold<num>(0, (sum, item) => sum + _num(item['line_total']));
    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
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
                          child: Text('POS Sale',
                              style: Theme.of(context).textTheme.titleMedium),
                        ),
                        OutlinedButton.icon(
                          onPressed: () =>
                              ref.invalidate(cashierPOSItemsProvider),
                          icon: const Icon(Icons.refresh, size: 16),
                          label: const Text('Refresh Items'),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    TextField(
                      controller: _catalogSearchController,
                      onChanged: (_) => setState(() {}),
                      decoration: const InputDecoration(
                        prefixIcon: Icon(Icons.search),
                        labelText: 'Search branch POS items',
                      ),
                    ),
                    const SizedBox(height: 12),
                    _buildCatalog(catalog),
                    const Divider(height: 32),
                    Text('Cart', style: Theme.of(context).textTheme.titleSmall),
                    const SizedBox(height: 8),
                    if (_items.isEmpty)
                      const EmptyState(message: 'No cart items')
                    else
                      ListView.separated(
                        shrinkWrap: true,
                        physics: const NeverScrollableScrollPhysics(),
                        itemCount: _items.length,
                        separatorBuilder: (_, __) => const Divider(height: 1),
                        itemBuilder: (_, index) {
                          final item = _items[index];
                          return ListTile(
                            title: Text(_text(item, ['name', 'product_name'])),
                            subtitle: Text(
                              '${_num(item['qty'])} x ${_money(item['unit_price'])}',
                            ),
                            trailing: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Text(_money(item['line_total'])),
                                IconButton(
                                  onPressed: () =>
                                      setState(() => _items.removeAt(index)),
                                  icon: const Icon(Icons.close, size: 16),
                                ),
                              ],
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
            child: Card(
              child: Padding(
                padding: const EdgeInsets.all(20),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Checkout',
                        style: Theme.of(context).textTheme.titleMedium),
                    const SizedBox(height: 12),
                    TextField(
                      controller: _customerController,
                      decoration:
                          const InputDecoration(labelText: 'Customer name'),
                    ),
                    const SizedBox(height: 12),
                    TextField(
                      controller: _phoneController,
                      decoration:
                          const InputDecoration(labelText: 'Phone/reference'),
                    ),
                    const SizedBox(height: 16),
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: [
                        _chip('CASH', 'Cash'),
                        _chip('MPESA', 'M-Pesa STK'),
                        _chip('MPESA_MANUAL', 'M-Pesa Manual'),
                        _chip('CARD', 'Card'),
                        _chip('CREDIT_BILL', 'Credit Bill'),
                      ],
                    ),
                    const Divider(height: 32),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text('Total',
                            style: TextStyle(fontWeight: FontWeight.bold)),
                        Text(
                          _money(total),
                          style: const TextStyle(
                            fontWeight: FontWeight.bold,
                            fontSize: 20,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 16),
                    SizedBox(
                      width: double.infinity,
                      child: ElevatedButton.icon(
                        onPressed: _items.isEmpty || _saving ? null : _checkout,
                        icon: const Icon(Icons.check_circle, size: 16),
                        label: const Text('Create and Pay'),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _chip(String value, String label) {
    return ChoiceChip(
      selected: _method == value,
      label: Text(label),
      onSelected: (_) => setState(() => _method = value),
    );
  }

  Widget _buildCatalog(AsyncValue<List<Map<String, dynamic>>> catalog) {
    return catalog.when(
      loading: () => const Padding(
        padding: EdgeInsets.symmetric(vertical: 24),
        child: Center(child: CircularProgressIndicator()),
      ),
      error: (error, _) => EmptyState(
        message: 'Could not load branch POS items: ${apiErrorMessage(error)}',
      ),
      data: (rows) {
        final search = _catalogSearchController.text.trim().toLowerCase();
        final filtered = rows.where((item) {
          if (search.isEmpty) return true;
          return [
            _text(item, ['name']),
            _text(item, ['sku']),
            _text(item, ['category']),
            _text(item, ['outlet_name']),
            _text(item, ['outlet_type']),
          ].any((value) => value.toLowerCase().contains(search));
        }).toList();

        if (filtered.isEmpty) {
          return const EmptyState(
            message: 'No branch POS items configured for this cashier branch',
          );
        }

        return ConstrainedBox(
          constraints: const BoxConstraints(maxHeight: 320),
          child: ListView.separated(
            shrinkWrap: true,
            itemCount: filtered.length,
            separatorBuilder: (_, __) => const Divider(height: 1),
            itemBuilder: (_, index) {
              final item = filtered[index];
              final price = _num(item['selling_price'] ?? item['price']);
              final subtitle = [
                _text(item, ['outlet_name', 'outlet_type']),
                _text(item, ['category']),
                _text(item, ['sku']),
              ].where((value) => value.isNotEmpty && value != '-').join(' • ');
              return ListTile(
                dense: true,
                contentPadding: EdgeInsets.zero,
                title: Text(_text(item, ['name'])),
                subtitle: subtitle.isEmpty ? null : Text(subtitle),
                trailing: Wrap(
                  spacing: 8,
                  crossAxisAlignment: WrapCrossAlignment.center,
                  children: [
                    Text(
                      _money(price),
                      style: const TextStyle(fontWeight: FontWeight.w700),
                    ),
                    IconButton.filledTonal(
                      tooltip: 'Add item',
                      onPressed: () => _addCatalogItem(item),
                      icon: const Icon(Icons.add, size: 18),
                    ),
                  ],
                ),
              );
            },
          ),
        );
      },
    );
  }

  Future<void> _addCatalogItem(Map<String, dynamic> catalogItem) async {
    final qty = await _quantityDialog(
      context,
      _text(catalogItem, ['name']),
    );
    if (qty == null || qty <= 0) return;

    final productId = _text(catalogItem, ['product_id', 'id']);
    final price = _num(catalogItem['selling_price'] ?? catalogItem['price']);
    final existingIndex =
        _items.indexWhere((item) => _text(item, ['product_id']) == productId);

    setState(() {
      if (existingIndex >= 0) {
        final current = Map<String, dynamic>.from(_items[existingIndex]);
        final nextQty = _num(current['qty']) + qty;
        current['qty'] = nextQty;
        current['line_total'] = nextQty * _num(current['unit_price']);
        _items[existingIndex] = current;
        return;
      }

      _items.add({
        'product_id': productId,
        'outlet_item_id': _text(catalogItem, ['outlet_item_id', 'id']),
        'outlet_id': _text(catalogItem, ['outlet_id']),
        'name': _text(catalogItem, ['name']),
        'sku': _text(catalogItem, ['sku']),
        'qty': qty,
        'unit_price': price,
        'discount_amount': 0,
        'tax_amount': 0,
        'line_total': qty * price,
      });
    });
  }

  Future<void> _checkout() async {
    final total =
        _items.fold<num>(0, (sum, item) => sum + _num(item['line_total']));
    setState(() => _saving = true);
    try {
      Map<String, dynamic>? credit;
      if (_method == 'CREDIT_BILL') {
        final staff = await ref
            .read(cashierRepositoryProvider)
            .getBranchStaff()
            .catchError((_) => <Map<String, dynamic>>[]);
        if (!mounted) return;
        credit = await _creditBillPayload(context, total, staffMembers: staff);
        if (credit == null) {
          setState(() => _saving = false);
          return;
        }
        final createdCredit =
            await ref.read(cashierRepositoryProvider).createCreditBill(credit);
        final createdCreditData = _payload(createdCredit);
        credit = {
          ...credit,
          if (_text(createdCreditData, ['id']).isNotEmpty)
            'id': _text(createdCreditData, ['id']),
          if (_text(createdCreditData, ['staff_credit_bill_id']).isNotEmpty)
            'staff_credit_bill_id':
                _text(createdCreditData, ['staff_credit_bill_id']),
          if (_text(createdCreditData, ['credit_number']).isNotEmpty)
            'credit_number': _text(createdCreditData, ['credit_number']),
        };
      }
      final created =
          await ref.read(cashierRepositoryProvider).createPOSTransaction({
        'customer_name': _customerController.text.trim(),
        'customer_phone': _phoneController.text.trim(),
        'total_amount': total,
        'items': _items,
      });
      final data = _payload(created);
      final id = _text(data, ['transaction_id', 'id']);
      await ref.read(cashierRepositoryProvider).payPOSTransaction(id, {
        'method': _method,
        if (_method == 'MPESA') 'phone_number': _phoneController.text.trim(),
        if (_method == 'MPESA_MANUAL')
          'reference': _phoneController.text.trim(),
        if (_method == 'CARD') 'reference': _phoneController.text.trim(),
        if (_method == 'CREDIT_BILL') 'credit_bill': credit,
      });
      await _printPosReceipt(
        transaction: data,
        total: total,
        method: _method,
        items: _items,
      );
      setState(() => _items.clear());
      ref.invalidate(cashierStatsProvider);
      ref.invalidate(cashierReconciliationProvider);
      _snack('POS transaction completed');
    } catch (error) {
      _snack('Checkout failed: ${apiErrorMessage(error)}');
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  void _snack(String message) {
    if (!mounted) return;
    AppNotifier.show(context, message);
  }

  Future<void> _printPosReceipt({
    required Map<String, dynamic> transaction,
    required num total,
    required String method,
    required List<Map<String, dynamic>> items,
  }) async {
    try {
      final nav = ref.read(dashboardNavProvider);
      final methodLabel = _receiptMethodLabel(method);
      final reference = _text(transaction, [
        'transaction_ref',
        'transaction_number',
        'short_code',
        'id',
      ]);
      await PrintService().printReceipt(
        SaleResult(
          transactionId: _text(transaction, ['id', 'transaction_id']),
          createdAt: DateTime.now(),
          receiptNumber: reference.isEmpty ? null : reference,
          cashierName: nav.user?.name,
          total: total.toDouble(),
          paymentMethod: methodLabel,
        ),
        items
            .map(
              (item) => CartItem(
                productId: _text(item, ['product_id', 'id']),
                name: _text(item, ['name', 'item_name']),
                unitPrice: _num(item['unit_price']).toDouble(),
                qty: (_num(item['qty'] ?? item['quantity'])).round(),
              ),
            )
            .toList(),
        nav.branchName,
        receiptType: '$methodLabel RECEIPT',
        customerName: _customerController.text.trim().isEmpty
            ? null
            : _customerController.text.trim(),
        publicCode: _text(transaction, ['short_code']),
      );
    } catch (error) {
      _snack(
        'Transaction completed, but receipt failed: ${apiErrorMessage(error)}',
      );
    }
  }
}

class _UnpaidBillsTab extends ConsumerStatefulWidget {
  const _UnpaidBillsTab();

  @override
  ConsumerState<_UnpaidBillsTab> createState() => _UnpaidBillsTabState();
}

class _UnpaidBillsTabState extends ConsumerState<_UnpaidBillsTab> {
  String _status = 'all';
  String _search = '';
  String _date = _dateOnly(DateTime.now());

  @override
  Widget build(BuildContext context) {
    // Bills for the current open shift (this tab is gated by _RequiresOpenShift,
    // so reaching here means a shift is open). Always scoped to today.
    final filters =
        CashierBillFilters(status: _status, search: _search, date: _date);
    final bills = ref.watch(cashierUnpaidBillsProvider(filters));
    return _BillsScaffold(
      title: 'Unpaid Bills — Current Shift',
      status: _status,
      onStatusChanged: (value) => setState(() => _status = value ?? 'all'),
      onSearch: (value) => setState(() => _search = value),
      // No Create — unpaid bills originate from the POS.
      onExport: _exportPdf,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          bills.when(
            data: (rows) => _BillList(
              rows: rows,
              emptyMessage: 'No unpaid bills for the current shift',
              onPay: (row) => _recordPayment(row),
            ),
            loading: () => const LoadingSkeleton(type: SkeletonType.list),
            error: (error, _) => ErrorState(message: apiErrorMessage(error)),
          ),
        ],
      ),
    );
  }

  Future<void> _exportPdf() async {
    try {
      final bytes =
          await ref.read(cashierRepositoryProvider).downloadUnpaidBillsPdf(
                date: _date,
                status: _status,
                search: _search,
              );
      if (bytes.isEmpty) {
        _snack('Export failed: empty PDF response');
        return;
      }
      await Printing.sharePdf(
        bytes: bytes,
        filename: 'FG_Unpaid_Bills_$_date.pdf',
      );
    } catch (error) {
      _snack('Export failed: ${apiErrorMessage(error)}');
    }
  }

  Future<void> _recordPayment(Map<String, dynamic> row) async {
    final staff = await ref
        .read(cashierRepositoryProvider)
        .getBranchStaff()
        .catchError((_) => <Map<String, dynamic>>[]);
    if (!mounted) return;
    final body = await _paymentPayload(
      context,
      _num(row['balance_amount'] ?? row['balance']),
      title: 'Confirm Payment',
      allowCreditBill: true,
      staffMembers: staff,
    );
    if (body == null) return;
    final payments = _paymentLinesFromPayload(body);
    final repo = ref.read(cashierRepositoryProvider);
    try {
      final source = _text(row, ['source']);
      final isWaiter = row['is_waiter_order'] == true &&
          (source == 'restaurant' || source == 'bar' || source == 'pos');
      final responses = <Map<String, dynamic>>[];
      final receiptRefs = <String>[];
      final totalPaid = payments.fold<num>(
        0,
        (sum, payment) => sum + _num(payment['payment_amount']),
      );
      for (final payment in payments) {
        if (_text(payment, ['payment_method']) == 'credit_bill') {
          // Convert this portion into a staff credit bill (settled later by the
          // branch accountant — cash receipt or payroll deduction).
          final response = await repo.createCreditBill({
            'staff_id': _text(payment, ['staff_id']),
            'staff_name': _text(payment, ['staff_name']),
            'bill_type': 'cashier_payment',
            'reference_type': 'cashier_payment',
            'reference_id': _text(row, ['id']),
            'total_amount': _num(payment['payment_amount']),
            'amount': _num(payment['payment_amount']),
            'due_date': _dateOnly(DateTime.now().add(const Duration(days: 30))),
            'payment_method': 'credit_bill',
            'deduction_months': 1,
            'remarks':
                'Credit settlement for bill ${_text(row, ['bill_number', 'order_number', 'id'])}',
          });
          responses.add(response);
          receiptRefs.add(_receiptReferenceForPayment(payment));
        } else if (isWaiter) {
          final response =
              await repo.clearWaiterOrder(source, _text(row, ['id']), payment);
          responses.add(response);
          receiptRefs.add(_receiptReferenceForPayment(payment));
        } else {
          final response =
              await repo.recordUnpaidBillPayment(_text(row, ['id']), payment);
          responses.add(response);
          receiptRefs.add(_receiptReferenceForPayment(payment));
        }
      }
      try {
        await _printCashierBillReceipt(
          ref: ref,
          bill: row,
          amount: totalPaid,
          method: payments.length == 1
              ? _text(payments.first, ['payment_method'])
              : 'split',
          response: responses.isEmpty ? const {} : responses.last,
          fallbackReference: receiptRefs.join(' | '),
        );
      } catch (error) {
        _snack(
            'Payment recorded, but receipt failed: ${apiErrorMessage(error)}');
      }
      ref.invalidate(cashierUnpaidBillsProvider);
      ref.invalidate(cashierStatsProvider);
      _snack(
          payments.length > 1 ? 'Split payment recorded' : 'Payment recorded');
    } catch (error) {
      _snack('Payment failed: ${apiErrorMessage(error)}');
    }
  }

  void _snack(String message) {
    if (!mounted) return;
    AppNotifier.show(context, message);
  }
}

class _ShiftsTab extends ConsumerStatefulWidget {
  const _ShiftsTab();

  @override
  ConsumerState<_ShiftsTab> createState() => _ShiftsTabState();
}

class _ShiftsTabState extends ConsumerState<_ShiftsTab> {
  String _status = 'all';

  @override
  Widget build(BuildContext context) {
    final allShifts =
        ref.watch(cashierShiftsProvider(const CashierShiftFilters()));
    final visibleShifts =
        ref.watch(cashierShiftsProvider(CashierShiftFilters(status: _status)));
    final hasOpenShift = allShifts.maybeWhen(
      data: (rows) => rows.any((row) => _shiftStatus(row) == 'open'),
      orElse: () => true,
    );
    final hasPendingShift = allShifts.maybeWhen(
      data: (rows) => rows.any((row) => _shiftStatus(row) == 'pending_open'),
      orElse: () => false,
    );
    final canRequestShift = !hasOpenShift && !hasPendingShift;
    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text('Shift Logbook',
                    style: Theme.of(context).textTheme.titleLarge),
              ),
              DropdownButton<String>(
                value: _status,
                items: const [
                  DropdownMenuItem(value: 'all', child: Text('All')),
                  DropdownMenuItem(
                      value: 'pending_open', child: Text('Pending Approval')),
                  DropdownMenuItem(value: 'open', child: Text('Open')),
                  DropdownMenuItem(value: 'closed', child: Text('Closed')),
                  DropdownMenuItem(
                      value: 'reconciled', child: Text('Reconciled')),
                ],
                onChanged: (value) => setState(() => _status = value ?? 'all'),
              ),
              const SizedBox(width: 12),
              Tooltip(
                message: hasPendingShift
                    ? 'Your shift opening request is waiting for branch accountant approval'
                    : hasOpenShift
                        ? 'Close the current open shift before starting another'
                        : 'Request approval to open a cashier shift',
                child: ElevatedButton.icon(
                  onPressed: canRequestShift ? _startShift : null,
                  icon: const Icon(Icons.play_arrow, size: 16),
                  label: Text(
                      hasPendingShift ? 'Awaiting Approval' : 'Request Shift'),
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          visibleShifts.when(
            data: (rows) => rows.isEmpty
                ? EmptyState(
                    message: 'No ${_statusLabel(_status)} shifts found')
                : Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        '${_statusLabel(_status)} shift history',
                        style: Theme.of(context).textTheme.titleMedium,
                      ),
                      const SizedBox(height: 8),
                      Card(
                        child: ListView.separated(
                          shrinkWrap: true,
                          physics: const NeverScrollableScrollPhysics(),
                          itemCount: rows.length,
                          separatorBuilder: (_, __) => const Divider(height: 1),
                          itemBuilder: (_, index) {
                            final row = rows[index];
                            final status = _shiftStatus(row);
                            return ExpansionTile(
                              leading: CircleAvatar(
                                backgroundColor: _statusColor(status)
                                    .withValues(alpha: 0.12),
                                child: Icon(Icons.access_time,
                                    color: _statusColor(status), size: 18),
                              ),
                              title: Text(_text(row, ['shift_number', 'id'])),
                              subtitle: Text(
                                  '${_date(row['requested_at'] ?? row['shift_start'] ?? row['opened_at'] ?? row['start_time'])} - ${_statusLabel(status)}'),
                              trailing: Text(_money(row['total_sales'] ??
                                  row['total_collections'] ??
                                  row['closing_float'] ??
                                  row['closing_cash'])),
                              childrenPadding:
                                  const EdgeInsets.fromLTRB(16, 0, 16, 16),
                              children: [
                                _KeyValueGrid(values: {
                                  'Opening float': _money(row['opening_float']),
                                  'Cash': _money(row['total_cash_sales'] ??
                                      row['total_cash']),
                                  'M-Pesa': _money(row['total_mpesa_sales'] ??
                                      row['total_mpesa']),
                                  'Card': _money(row['total_card_sales'] ??
                                      row['total_card']),
                                  'Credit Bills': _money(
                                      row['credit_bills_taken'] ??
                                          row['total_credit'] ??
                                          row['credit_bills_value']),
                                  'Expected cash': _money(
                                      row['expected_closing_float'] ??
                                          row['expected_cash']),
                                }),
                                if (_creditBillDetails(row).isNotEmpty) ...[
                                  const SizedBox(height: 10),
                                  Align(
                                    alignment: Alignment.centerLeft,
                                    child: Text('Credit bills — who for',
                                        style: Theme.of(context)
                                            .textTheme
                                            .titleSmall),
                                  ),
                                  const SizedBox(height: 4),
                                  for (final c in _creditBillDetails(row))
                                    Padding(
                                      padding:
                                          const EdgeInsets.symmetric(vertical: 2),
                                      child: Row(
                                        children: [
                                          const Icon(Icons.badge_outlined,
                                              size: 14,
                                              color: AppColors.kTextSecondary),
                                          const SizedBox(width: 6),
                                          Expanded(
                                            child: Text(_text(c, [
                                              'name',
                                              'staff_name',
                                              'customer_name'
                                            ])),
                                          ),
                                          Text(
                                              _money(c['amount'] ??
                                                  c['total_amount']),
                                              style: const TextStyle(
                                                  fontWeight: FontWeight.w700)),
                                        ],
                                      ),
                                    ),
                                ],
                                const SizedBox(height: 8),
                                Row(
                                  children: [
                                    OutlinedButton.icon(
                                      onPressed: status == 'open'
                                          ? () => _closeShift(row)
                                          : null,
                                      icon: const Icon(Icons.stop, size: 16),
                                      label: const Text('Close'),
                                    ),
                                    if (status == 'pending_open') ...[
                                      const SizedBox(width: 8),
                                      const Expanded(
                                        child: Text(
                                          'Waiting for branch accountant approval',
                                          style: TextStyle(
                                            color: AppColors.kTextSecondary,
                                            fontWeight: FontWeight.w700,
                                          ),
                                        ),
                                      ),
                                    ],
                                  ],
                                ),
                              ],
                            );
                          },
                        ),
                      ),
                    ],
                  ),
            loading: () => const LoadingSkeleton(type: SkeletonType.list),
            error: (error, _) => ErrorState(message: apiErrorMessage(error)),
          ),
        ],
      ),
    );
  }

  Future<void> _startShift() async {
    final opening =
        await _numberDialog(context, 'Request Shift Opening', 'Opening float');
    if (opening == null) return;
    try {
      await ref.read(cashierRepositoryProvider).startShift(opening);
      ref.invalidate(cashierShiftsProvider);
      _snack('Shift opening requested. Wait for branch accountant approval.');
    } catch (error) {
      _snack('Start shift failed: ${apiErrorMessage(error)}');
    }
  }

  Future<void> _closeShift(Map<String, dynamic> row) async {
    try {
      final repo = ref.read(cashierRepositoryProvider);
      final shiftId = _text(row, ['id']);
      if (!mounted) return;
      final payload = await _automatedShiftCloseDialog(context);
      if (payload == null) return;
      await repo.closeShift(shiftId, payload);
      ref.invalidate(cashierShiftsProvider);
      _snack('Shift closed. Lina generated the logbook for accountant review.');
    } catch (error) {
      _snack('Close shift failed: ${apiErrorMessage(error)}');
    }
  }

  void _snack(String message) {
    if (!mounted) return;
    AppNotifier.show(context, message);
  }
}

Future<Map<String, dynamic>?> _automatedShiftCloseDialog(BuildContext context) {
  final cashController = TextEditingController();
  final notesController = TextEditingController();
  return showDialog<Map<String, dynamic>>(
    context: context,
    builder: (context) => AlertDialog(
      title: const Text('Close shift with Lina'),
      content: SizedBox(
        width: 420,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Lina will generate the cashier logbook, migrate waiter unpaid bills to staff credit bills, post POS stock adjustments, and send the logbook to the branch accountant.',
            ),
            const SizedBox(height: 16),
            TextField(
              controller: cashController,
              keyboardType:
                  const TextInputType.numberWithOptions(decimal: true),
              decoration: const InputDecoration(
                labelText: 'Counted cash (optional)',
                helperText: 'Leave blank to use expected cash.',
              ),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: notesController,
              maxLines: 2,
              decoration: const InputDecoration(
                labelText: 'Close note (optional)',
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
        ElevatedButton.icon(
          icon: const Icon(Icons.auto_awesome),
          onPressed: () {
            final cashText = cashController.text.trim();
            final notes = notesController.text.trim();
            Navigator.pop(context, {
              'automation_mode': 'lina',
              if (cashText.isNotEmpty)
                'actual_cash': num.tryParse(cashText) ?? 0,
              if (cashText.isNotEmpty)
                'closing_float': num.tryParse(cashText) ?? 0,
              if (notes.isNotEmpty) 'remarks': notes,
            });
          },
          label: const Text('Close Shift'),
        ),
      ],
    ),
  ).whenComplete(() {
    cashController.dispose();
    notesController.dispose();
  });
}

class _ShiftCreditEntry {
  const _ShiftCreditEntry({
    required this.staffId,
    required this.name,
    required this.amount,
    this.reference,
  });

  final String staffId;
  final String name;
  final num amount;
  final String? reference;

  Map<String, dynamic> toJson() => {
        'staff_id': staffId.isEmpty ? null : staffId,
        'name': name,
        'amount': amount,
        if (reference != null && reference!.isNotEmpty) 'reference': reference,
        'time': DateTime.now().toIso8601String(),
      };
}

class _ShiftStaffMember {
  const _ShiftStaffMember({
    required this.id,
    required this.userId,
    required this.name,
    required this.employeeId,
    required this.department,
    required this.email,
  });

  final String id;
  final String userId;
  final String name;
  final String employeeId;
  final String department;
  final String email;
}

/// Searchable, branch-filtered staff selector (Autocomplete) for assigning a
/// credit bill to a staff member. Loads from the branch staff list.
class _StaffSearchField extends StatefulWidget {
  const _StaffSearchField({
    required this.staff,
    required this.onSelected,
    this.initialId,
    this.label = 'Staff member (search)',
  });

  final List<_ShiftStaffMember> staff;
  final ValueChanged<_ShiftStaffMember?> onSelected;
  final String? initialId;
  final String label;

  @override
  State<_StaffSearchField> createState() => _StaffSearchFieldState();
}

class _StaffSearchFieldState extends State<_StaffSearchField> {
  String _label(_ShiftStaffMember s) => [
        s.name,
        if (s.employeeId.isNotEmpty) s.employeeId,
        if (s.department.isNotEmpty) s.department,
      ].join(' · ');

  @override
  Widget build(BuildContext context) {
    _ShiftStaffMember? initial;
    for (final s in widget.staff) {
      if (s.id == widget.initialId) {
        initial = s;
        break;
      }
    }
    return Autocomplete<_ShiftStaffMember>(
      initialValue: TextEditingValue(text: initial != null ? _label(initial) : ''),
      displayStringForOption: _label,
      optionsBuilder: (value) {
        final q = value.text.trim().toLowerCase();
        if (q.isEmpty) return widget.staff;
        return widget.staff.where((s) =>
            s.name.toLowerCase().contains(q) ||
            s.employeeId.toLowerCase().contains(q) ||
            s.department.toLowerCase().contains(q) ||
            s.email.toLowerCase().contains(q));
      },
      onSelected: widget.onSelected,
      fieldViewBuilder: (context, controller, focusNode, onSubmit) {
        return TextField(
          controller: controller,
          focusNode: focusNode,
          decoration: InputDecoration(
            labelText: widget.label,
            isDense: true,
            prefixIcon: const Icon(Icons.search, size: 18),
            hintText: 'Type a name…',
          ),
          onChanged: (v) {
            if (v.trim().isEmpty) widget.onSelected(null);
          },
        );
      },
      optionsViewBuilder: (context, onSelected, options) {
        return Align(
          alignment: Alignment.topLeft,
          child: Material(
            elevation: 4,
            borderRadius: BorderRadius.circular(8),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxHeight: 280, maxWidth: 460),
              child: ListView.builder(
                padding: EdgeInsets.zero,
                shrinkWrap: true,
                itemCount: options.length,
                itemBuilder: (context, i) {
                  final s = options.elementAt(i);
                  return ListTile(
                    dense: true,
                    title: Text(s.name),
                    subtitle: ([s.employeeId, s.department]
                            .where((e) => e.isNotEmpty)
                            .isEmpty)
                        ? null
                        : Text([s.employeeId, s.department]
                            .where((e) => e.isNotEmpty)
                            .join(' · ')),
                    onTap: () => onSelected(s),
                  );
                },
              ),
            ),
          ),
        );
      },
    );
  }
}

class _ShiftStockEntry {
  _ShiftStockEntry(Map<String, dynamic> item)
      : itemName = _text(item, ['name', 'product_name', 'item_name']),
        unit = _text(item, ['unit']),
        opening = _num(item['current_stock'] ?? item['opening_stock']),
        additions = 0,
        sold = 0,
        physical = null,
        reason = '';

  final String itemName;
  final String unit;
  final num opening;
  num additions;
  num sold;
  num? physical;
  String reason;

  num get systemClosing => opening + additions - sold;
  num get variance => physical == null ? 0 : physical! - systemClosing;

  Map<String, dynamic> toJson() => {
        'item_name': itemName,
        'unit': unit,
        'opening_stock': opening,
        'additions': additions,
        'sold_quantity': sold,
        'system_closing_stock': systemClosing,
        'physical_count': physical,
        'variance': variance,
        'variance_reason': reason,
      };
}

// Kept temporarily for rollback while Lina close automation is being rolled out.
// ignore: unused_element
Future<Map<String, dynamic>?> _shiftCloseLogbookDialog(
  BuildContext context, {
  required Map<String, dynamic> shift,
  required List<Map<String, dynamic>> stockItems,
  required List<Map<String, dynamic>> staffMembers,
}) {
  final closingCash = TextEditingController();
  final cashAtHand = TextEditingController();
  final cashDeposited = TextEditingController();
  final bankRef = TextEditingController();
  final handoverNotes = TextEditingController();
  final stockNotes = TextEditingController();

  final revenueControllers = <String, TextEditingController>{
    'restaurant_revenue': TextEditingController(
        text: _num(shift['restaurant_revenue']).toStringAsFixed(0)),
    'bar_revenue': TextEditingController(
        text: _num(shift['bar_revenue']).toStringAsFixed(0)),
    'room_booking_revenue': TextEditingController(
        text: _num(shift['room_booking_revenue']).toStringAsFixed(0)),
    'conference_revenue': TextEditingController(
        text: _num(shift['conference_revenue']).toStringAsFixed(0)),
    'swimming_pool_revenue': TextEditingController(
        text: _num(shift['swimming_pool_revenue']).toStringAsFixed(0)),
    'pool_token_revenue': TextEditingController(
        text: _num(shift['pool_token_revenue']).toStringAsFixed(0)),
    'other_revenue': TextEditingController(
        text: _num(shift['other_revenue']).toStringAsFixed(0)),
  };

  final creditStaffId = TextEditingController();
  final creditName = TextEditingController();
  final creditAmount = TextEditingController();
  final paidStaffId = TextEditingController();
  final paidName = TextEditingController();
  final paidAmount = TextEditingController();
  final staffOptions = _shiftStaffMembers(staffMembers);
  final creditEntries = _shiftCreditEntries(
    shift,
    detailKeys: const ['credit_bills_details', 'credit_bills'],
    staffMembers: staffOptions,
  );
  final paidEntries = _shiftCreditEntries(
    shift,
    detailKeys: const ['paid_bills_details', 'paid_bills'],
    staffMembers: staffOptions,
  );
  final stockEntries = stockItems
      .where((item) => _text(item, ['name', 'product_name']).isNotEmpty)
      .take(40)
      .map(_ShiftStockEntry.new)
      .toList();

  bool poolNa = shift['pool_na'] == true;
  bool conferenceNa = shift['conference_na'] == true;
  bool roomsNa = shift['rooms_na'] == true;

  num controllerAmount(String key) =>
      num.tryParse(revenueControllers[key]?.text.trim() ?? '') ?? 0;

  void disposeAll() {
    closingCash.dispose();
    cashAtHand.dispose();
    cashDeposited.dispose();
    bankRef.dispose();
    handoverNotes.dispose();
    stockNotes.dispose();
    creditStaffId.dispose();
    creditName.dispose();
    creditAmount.dispose();
    paidStaffId.dispose();
    paidName.dispose();
    paidAmount.dispose();
    for (final controller in revenueControllers.values) {
      controller.dispose();
    }
  }

  return showDialog<Map<String, dynamic>>(
    context: context,
    builder: (context) => StatefulBuilder(
      builder: (context, setDialogState) {
        final openingFloat = _num(shift['opening_float']);
        final cashSales =
            _num(shift['total_cash_sales'] ?? shift['total_cash']);
        final mpesaSales =
            _num(shift['total_mpesa_sales'] ?? shift['total_mpesa']);
        final cardSales =
            _num(shift['total_card_sales'] ?? shift['total_card']);
        final paidBillsTotal =
            paidEntries.fold<num>(0, (sum, entry) => sum + entry.amount);
        final creditBillsTotal =
            creditEntries.fold<num>(0, (sum, entry) => sum + entry.amount);
        final actualCash = num.tryParse(closingCash.text.trim()) ?? 0;
        final expectedCash = openingFloat + cashSales + paidBillsTotal;
        final variance = actualCash - expectedCash;

        return Dialog(
          insetPadding: const EdgeInsets.all(24),
          child: SizedBox(
            width: 1120,
            height: 760,
            child: Column(
              children: [
                Padding(
                  padding: const EdgeInsets.fromLTRB(24, 20, 24, 12),
                  child: Row(
                    children: [
                      Expanded(
                        child: Text(
                          'Close Shift Logbook',
                          style: Theme.of(context).textTheme.headlineSmall,
                        ),
                      ),
                      Text(_text(shift, ['shift_number', 'id'])),
                    ],
                  ),
                ),
                const Divider(height: 1),
                Expanded(
                  child: SingleChildScrollView(
                    padding: const EdgeInsets.all(24),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        _KeyValueGrid(values: {
                          'Opening float': _money(openingFloat),
                          'Cash sales': _money(cashSales),
                          'M-Pesa sales': _money(mpesaSales),
                          'Card sales': _money(cardSales),
                          'Credit sales': _money(creditBillsTotal),
                          'Expected cash': _money(expectedCash),
                          'Variance': _money(variance),
                        }),
                        const SizedBox(height: 20),
                        Text('Cash reconciliation',
                            style: Theme.of(context).textTheme.titleMedium),
                        const SizedBox(height: 12),
                        Wrap(
                          spacing: 12,
                          runSpacing: 12,
                          children: [
                            _amountField(closingCash, 'Actual cash counted',
                                onChanged: (_) => setDialogState(() {})),
                            _amountField(cashAtHand, 'Cash at hand'),
                            _amountField(cashDeposited, 'Cash deposited'),
                            SizedBox(
                              width: 260,
                              child: TextField(
                                controller: bankRef,
                                decoration: const InputDecoration(
                                    labelText: 'Bank deposit reference'),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 24),
                        Text('Revenue sources',
                            style: Theme.of(context).textTheme.titleMedium),
                        const SizedBox(height: 12),
                        Wrap(
                          spacing: 12,
                          runSpacing: 12,
                          children: [
                            _amountField(
                                revenueControllers['restaurant_revenue']!,
                                'Restaurant'),
                            _amountField(
                                revenueControllers['bar_revenue']!, 'Bar'),
                            _amountField(
                                revenueControllers['room_booking_revenue']!,
                                'Rooms',
                                enabled: !roomsNa),
                            _amountField(
                                revenueControllers['conference_revenue']!,
                                'Conference',
                                enabled: !conferenceNa),
                            _amountField(
                                revenueControllers['swimming_pool_revenue']!,
                                'Swimming pool',
                                enabled: !poolNa),
                            _amountField(
                                revenueControllers['pool_token_revenue']!,
                                'Pool tokens',
                                enabled: !poolNa),
                            _amountField(
                                revenueControllers['other_revenue']!, 'Other'),
                          ],
                        ),
                        Wrap(
                          spacing: 16,
                          children: [
                            CheckboxListTile(
                              value: roomsNa,
                              title: const Text('Rooms N/A'),
                              dense: true,
                              controlAffinity: ListTileControlAffinity.leading,
                              onChanged: (value) => setDialogState(
                                  () => roomsNa = value ?? false),
                            ),
                            CheckboxListTile(
                              value: conferenceNa,
                              title: const Text('Conference N/A'),
                              dense: true,
                              controlAffinity: ListTileControlAffinity.leading,
                              onChanged: (value) => setDialogState(
                                  () => conferenceNa = value ?? false),
                            ),
                            CheckboxListTile(
                              value: poolNa,
                              title: const Text('Pool N/A'),
                              dense: true,
                              controlAffinity: ListTileControlAffinity.leading,
                              onChanged: (value) =>
                                  setDialogState(() => poolNa = value ?? false),
                            ),
                          ]
                              .map(
                                  (child) => SizedBox(width: 190, child: child))
                              .toList(),
                        ),
                        const SizedBox(height: 24),
                        Text('Credit bills and paid bills',
                            style: Theme.of(context).textTheme.titleMedium),
                        const SizedBox(height: 12),
                        Wrap(
                          spacing: 12,
                          runSpacing: 12,
                          children: [
                            _creditEntryPanel(
                              context,
                              title: 'Credit issued',
                              staffMembers: staffOptions,
                              staffId: creditStaffId,
                              name: creditName,
                              amount: creditAmount,
                              entries: creditEntries,
                              onAdd: () => setDialogState(() {
                                final amount =
                                    num.tryParse(creditAmount.text.trim()) ?? 0;
                                if (amount <= 0) return;
                                creditEntries.add(_ShiftCreditEntry(
                                  staffId: creditStaffId.text.trim(),
                                  name: creditName.text.trim(),
                                  amount: amount,
                                ));
                                creditStaffId.clear();
                                creditName.clear();
                                creditAmount.clear();
                              }),
                              onRemove: (index) => setDialogState(
                                  () => creditEntries.removeAt(index)),
                            ),
                            _creditEntryPanel(
                              context,
                              title: 'Debt receipts',
                              staffMembers: staffOptions,
                              staffId: paidStaffId,
                              name: paidName,
                              amount: paidAmount,
                              entries: paidEntries,
                              onAdd: () => setDialogState(() {
                                final amount =
                                    num.tryParse(paidAmount.text.trim()) ?? 0;
                                if (amount <= 0) return;
                                paidEntries.add(_ShiftCreditEntry(
                                  staffId: paidStaffId.text.trim(),
                                  name: paidName.text.trim(),
                                  amount: amount,
                                ));
                                paidStaffId.clear();
                                paidName.clear();
                                paidAmount.clear();
                              }),
                              onRemove: (index) => setDialogState(
                                  () => paidEntries.removeAt(index)),
                            ),
                          ],
                        ),
                        const SizedBox(height: 24),
                        Text('Cashier inventory stock take',
                            style: Theme.of(context).textTheme.titleMedium),
                        const SizedBox(height: 8),
                        if (stockEntries.isEmpty)
                          const EmptyState(
                              message:
                                  'No cashier POS items found for stock take')
                        else
                          _stockTakeTable(stockEntries, setDialogState),
                        const SizedBox(height: 12),
                        TextField(
                          controller: stockNotes,
                          minLines: 2,
                          maxLines: 4,
                          decoration: const InputDecoration(
                              labelText: 'Stock take notes / variance summary'),
                        ),
                        const SizedBox(height: 24),
                        TextField(
                          controller: handoverNotes,
                          minLines: 3,
                          maxLines: 5,
                          decoration: const InputDecoration(
                              labelText: 'Handover / variance notes'),
                        ),
                      ],
                    ),
                  ),
                ),
                const Divider(height: 1),
                Padding(
                  padding: const EdgeInsets.all(16),
                  child: Row(
                    children: [
                      Text(
                          'Expected ${_money(expectedCash)}  •  Variance ${_money(variance)}'),
                      const Spacer(),
                      TextButton(
                        onPressed: () => Navigator.pop(context),
                        child: const Text('Cancel'),
                      ),
                      const SizedBox(width: 12),
                      ElevatedButton.icon(
                        onPressed: () {
                          if (closingCash.text.trim().isEmpty) return;
                          final unexplainedStockVariance = stockEntries.any(
                              (entry) =>
                                  entry.variance != 0 &&
                                  entry.reason.trim().isEmpty);
                          if (unexplainedStockVariance) return;
                          final stockJson = stockEntries
                              .map((entry) => entry.toJson())
                              .toList();
                          final notes = [
                            handoverNotes.text.trim(),
                            if (stockNotes.text.trim().isNotEmpty)
                              'Stock notes: ${stockNotes.text.trim()}',
                            if (stockJson.isNotEmpty) 'Stock take: $stockJson',
                          ].where((line) => line.isNotEmpty).join('\n\n');
                          Navigator.pop(context, {
                            'closing_float':
                                num.tryParse(closingCash.text.trim()) ?? 0,
                            'notes': notes,
                            for (final key in revenueControllers.keys)
                              key: controllerAmount(key),
                            'credit_bills_taken': creditBillsTotal,
                            'credit_bills_count': creditEntries.length,
                            'credit_bills_details': creditEntries
                                .map((entry) => entry.toJson())
                                .toList(),
                            'paid_bills_value': paidBillsTotal,
                            'paid_bills_count': paidEntries.length,
                            'paid_bills_details': paidEntries
                                .map((entry) => entry.toJson())
                                .toList(),
                            'unpaid_bills_value':
                                (creditBillsTotal - paidBillsTotal)
                                    .clamp(0, creditBillsTotal),
                            'unpaid_bills_count': creditEntries.length,
                            'cash_at_hand':
                                num.tryParse(cashAtHand.text.trim()) ??
                                    num.tryParse(closingCash.text.trim()) ??
                                    0,
                            'cash_deposited':
                                num.tryParse(cashDeposited.text.trim()) ?? 0,
                            'bank_deposit_ref': bankRef.text.trim(),
                            'pool_na': poolNa,
                            'conference_na': conferenceNa,
                            'rooms_na': roomsNa,
                          });
                        },
                        icon: const Icon(Icons.archive, size: 16),
                        label: const Text('Archive Shift Log'),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        );
      },
    ),
  ).whenComplete(disposeAll);
}

Widget _amountField(
  TextEditingController controller,
  String label, {
  bool enabled = true,
  ValueChanged<String>? onChanged,
}) {
  return SizedBox(
    width: 220,
    child: TextField(
      controller: controller,
      enabled: enabled,
      onChanged: onChanged,
      keyboardType: TextInputType.number,
      decoration: InputDecoration(labelText: label),
    ),
  );
}

List<_ShiftStaffMember> _shiftStaffMembers(
  List<Map<String, dynamic>> rows,
) {
  final members = rows
      .map<_ShiftStaffMember?>((row) {
        final user = _payload(row['user']);
        final id = _text(row, ['id']);
        final userId = _text(row, ['user_id']).isNotEmpty
            ? _text(row, ['user_id'])
            : _text(user, ['id']);
        if (id.isNotEmpty && userId.isNotEmpty && id == userId) {
          return null;
        }
        final firstName = _text(row, ['first_name']).isNotEmpty
            ? _text(row, ['first_name'])
            : _text(user, ['first_name']);
        final lastName = _text(row, ['last_name']).isNotEmpty
            ? _text(row, ['last_name'])
            : _text(user, ['last_name']);
        final name = [firstName, lastName]
            .where((part) => part.trim().isNotEmpty)
            .join(' ')
            .trim();
        return _ShiftStaffMember(
          id: id,
          userId: userId,
          name:
              name.isEmpty ? _text(row, ['name', 'full_name', 'email']) : name,
          employeeId: _text(row, ['employee_id', 'id_number']),
          department: _text(row, ['department', 'role']),
          email: _text(row, ['email']).isNotEmpty
              ? _text(row, ['email'])
              : _text(user, ['email']),
        );
      })
      .whereType<_ShiftStaffMember>()
      .where((staff) => staff.id.isNotEmpty && staff.name.isNotEmpty)
      .toList();
  members.sort((a, b) => a.name.compareTo(b.name));
  return members;
}

_ShiftStaffMember? _shiftStaffById(
  List<_ShiftStaffMember> members,
  String? id,
) {
  for (final member in members) {
    if (member.id == id) return member;
  }
  return null;
}

List<_ShiftCreditEntry> _shiftCreditEntries(
  Map<String, dynamic> shift, {
  required List<String> detailKeys,
  required List<_ShiftStaffMember> staffMembers,
}) {
  final entries = <_ShiftCreditEntry>[];
  final seen = <String>{};

  void addEntry(dynamic raw) {
    final row = _payload(raw);
    if (row.isEmpty) return;
    final staffId = _text(row, [
      'staff_id',
      'staff_profile_id',
      'employee_id',
    ]);
    final amount = _num(row['amount'] ?? row['total_amount']);
    if (staffId.isEmpty || amount <= 0) return;
    final name = _text(row, [
      'name',
      'staff_name',
      'customer_name',
      'payer_name',
    ]);
    final reference = _text(row, [
      'reference',
      'credit_number',
      'transaction_ref',
      'payment_reference',
    ]);
    final key = '$staffId|$amount|$reference';
    if (!seen.add(key)) return;
    final staff = _shiftStaffById(staffMembers, staffId);
    entries.add(_ShiftCreditEntry(
      staffId: staffId,
      name: name.isEmpty ? staff?.name ?? '' : name,
      amount: amount,
      reference: reference.isEmpty ? null : reference,
    ));
  }

  for (final key in detailKeys) {
    final value = shift[key];
    if (value is List) {
      for (final row in value) {
        addEntry(row);
      }
    }
  }

  final transactions = shift['transactions'];
  if (transactions is List) {
    for (final transaction in transactions) {
      final row = _payload(transaction);
      final method = _text(row, ['payment_method', 'method']).toLowerCase();
      if (!method.contains('credit')) continue;
      addEntry(row);
    }
  }

  return entries;
}

Widget _creditEntryPanel(
  BuildContext context, {
  required String title,
  required List<_ShiftStaffMember> staffMembers,
  required TextEditingController staffId,
  required TextEditingController name,
  required TextEditingController amount,
  required List<_ShiftCreditEntry> entries,
  required VoidCallback onAdd,
  required ValueChanged<int> onRemove,
}) {
  return SizedBox(
    width: 500,
    child: Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(title, style: Theme.of(context).textTheme.titleSmall),
            const SizedBox(height: 12),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              crossAxisAlignment: WrapCrossAlignment.center,
              children: [
                if (staffMembers.isEmpty)
                  SizedBox(
                    width: 150,
                    child: TextField(
                      controller: staffId,
                      decoration:
                          const InputDecoration(labelText: 'Staff profile ID'),
                    ),
                  )
                else
                  SizedBox(
                    width: 290,
                    child: DropdownButtonFormField<String>(
                      initialValue:
                          staffMembers.any((staff) => staff.id == staffId.text)
                              ? staffId.text
                              : null,
                      isExpanded: true,
                      menuMaxHeight: 360,
                      items: staffMembers
                          .map(
                            (staff) => DropdownMenuItem<String>(
                              value: staff.id,
                              child: Text(
                                [
                                  staff.name,
                                  if (staff.employeeId.isNotEmpty)
                                    staff.employeeId,
                                  if (staff.department.isNotEmpty)
                                    staff.department,
                                ].join(' - '),
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                          )
                          .toList(),
                      onChanged: (value) {
                        final selected = _shiftStaffById(
                          staffMembers,
                          value,
                        );
                        staffId.text = selected?.id ?? '';
                        name.text = selected?.name ?? '';
                      },
                      decoration:
                          const InputDecoration(labelText: 'Staff member'),
                    ),
                  ),
                SizedBox(
                  width: 130,
                  child: TextField(
                    controller: name,
                    readOnly: staffMembers.isNotEmpty,
                    decoration: const InputDecoration(labelText: 'Name'),
                  ),
                ),
                SizedBox(
                  width: 110,
                  child: TextField(
                    controller: amount,
                    keyboardType: TextInputType.number,
                    decoration: const InputDecoration(labelText: 'Amount'),
                  ),
                ),
                IconButton.filled(
                  onPressed: onAdd,
                  icon: const Icon(Icons.add, size: 18),
                ),
              ],
            ),
            const SizedBox(height: 8),
            if (entries.isEmpty)
              const Text('No entries',
                  style: TextStyle(color: AppColors.kTextSecondary))
            else
              for (var i = 0; i < entries.length; i++)
                ListTile(
                  dense: true,
                  contentPadding: EdgeInsets.zero,
                  title:
                      Text(entries[i].name.isEmpty ? 'Staff' : entries[i].name),
                  subtitle: Text(entries[i].staffId),
                  trailing: Wrap(
                    spacing: 8,
                    crossAxisAlignment: WrapCrossAlignment.center,
                    children: [
                      Text(_money(entries[i].amount)),
                      IconButton(
                        onPressed: () => onRemove(i),
                        icon: const Icon(Icons.close, size: 16),
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

Widget _stockTakeTable(
  List<_ShiftStockEntry> rows,
  void Function(void Function()) setDialogState,
) {
  const tableWidth = 1120.0;
  return Card(
    child: Padding(
      padding: const EdgeInsets.all(12),
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        child: SizedBox(
          width: tableWidth,
          child: Column(
            children: [
              const _StockHeaderRow(),
              const Divider(height: 1),
              for (final row in rows) ...[
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 6),
                  child: Row(
                    children: [
                      SizedBox(width: 200, child: Text(row.itemName)),
                      SizedBox(
                          width: 115,
                          child: Text('${row.opening} ${row.unit}')),
                      SizedBox(
                        width: 115,
                        child: _smallNumberCell(
                          initial: row.additions,
                          onChanged: (value) =>
                              setDialogState(() => row.additions = value),
                        ),
                      ),
                      SizedBox(
                        width: 100,
                        child: _smallNumberCell(
                          initial: row.sold,
                          onChanged: (value) =>
                              setDialogState(() => row.sold = value),
                        ),
                      ),
                      SizedBox(
                          width: 110,
                          child: Text(row.systemClosing.toStringAsFixed(2))),
                      SizedBox(
                        width: 115,
                        child: _smallNumberCell(
                          initial: row.physical,
                          onChanged: (value) =>
                              setDialogState(() => row.physical = value),
                        ),
                      ),
                      SizedBox(
                          width: 100,
                          child: Text(row.variance.toStringAsFixed(2))),
                      SizedBox(
                        width: 260,
                        child: TextField(
                          onChanged: (value) => row.reason = value,
                          decoration: const InputDecoration(
                            isDense: true,
                            hintText: 'Required if variance',
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                const Divider(height: 1),
              ],
            ],
          ),
        ),
      ),
    ),
  );
}

class _StockHeaderRow extends StatelessWidget {
  const _StockHeaderRow();

  @override
  Widget build(BuildContext context) {
    const style = TextStyle(fontWeight: FontWeight.bold);
    return const Padding(
      padding: EdgeInsets.symmetric(vertical: 8),
      child: Row(
        children: [
          SizedBox(width: 200, child: Text('Item', style: style)),
          SizedBox(width: 115, child: Text('Opening', style: style)),
          SizedBox(width: 115, child: Text('Additions', style: style)),
          SizedBox(width: 100, child: Text('Sold', style: style)),
          SizedBox(width: 110, child: Text('System', style: style)),
          SizedBox(width: 115, child: Text('Physical', style: style)),
          SizedBox(width: 100, child: Text('Variance', style: style)),
          SizedBox(width: 260, child: Text('Reason', style: style)),
        ],
      ),
    );
  }
}

Widget _smallNumberCell({
  required num? initial,
  required ValueChanged<num> onChanged,
}) {
  final controller = TextEditingController(
      text: initial == null ? '' : initial.toStringAsFixed(0));
  return SizedBox(
    width: 90,
    child: TextField(
      controller: controller,
      keyboardType: TextInputType.number,
      onChanged: (value) => onChanged(num.tryParse(value.trim()) ?? 0),
      decoration: const InputDecoration(isDense: true),
    ),
  );
}

class _BarcodeTab extends ConsumerStatefulWidget {
  const _BarcodeTab();

  @override
  ConsumerState<_BarcodeTab> createState() => _BarcodeTabState();
}

class _BarcodeTabState extends ConsumerState<_BarcodeTab> {
  final _controller = TextEditingController();
  bool _loading = false;
  Map<String, dynamic>? _result;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Card(
        child: Padding(
          padding: const EdgeInsets.all(20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Barcode Scan',
                  style: Theme.of(context).textTheme.titleLarge),
              const SizedBox(height: 12),
              TextField(
                controller: _controller,
                autofocus: true,
                onSubmitted: (_) => _scan(),
                decoration: const InputDecoration(
                  labelText: 'Scan barcode or enter short code / order number',
                  prefixIcon: Icon(Icons.qr_code_scanner),
                ),
              ),
              const SizedBox(height: 12),
              ElevatedButton.icon(
                onPressed: _loading ? null : _scan,
                icon: const Icon(Icons.search, size: 16),
                label: const Text('Scan'),
              ),
              const SizedBox(height: 20),
              if (_loading)
                const LoadingSkeleton(type: SkeletonType.list)
              else if (_result == null)
                const EmptyState(message: 'No scanned bill loaded')
              else
                _BillSummary(bill: _payload(_result!), onCopyReference: null),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _scan() async {
    final code = _controller.text.trim();
    if (code.isEmpty) return;
    setState(() => _loading = true);
    try {
      final result =
          await ref.read(cashierRepositoryProvider).scanPOSBarcode(code);
      setState(() => _result = result);
    } catch (error) {
      if (mounted) {
        AppNotifier.show(
          context,
          'Scan failed: ${apiErrorMessage(error)}',
          isError: true,
        );
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }
}

class _InsightsTab extends ConsumerWidget {
  const _InsightsTab();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final stats = ref.watch(cashierStatsProvider);
    final reconciliation = ref.watch(cashierReconciliationProvider);
    final insights = ref.watch(cashierInsightsProvider);
    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: _AsyncStatCard(
                  value: stats,
                  label: 'Cash',
                  keys: const ['total_cash', 'cash_total'],
                  icon: Icons.money,
                  color: AppColors.kSuccess,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: _AsyncStatCard(
                  value: stats,
                  label: 'M-Pesa',
                  keys: const ['total_mpesa', 'mpesa_total'],
                  icon: Icons.phone_android,
                  color: AppColors.kPrimary,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: _AsyncStatCard(
                  value: stats,
                  label: 'Card',
                  keys: const ['total_card', 'card_total'],
                  icon: Icons.credit_card,
                  color: AppColors.kAccent,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: _AsyncStatCard(
                  value: stats,
                  label: 'Credit Bills',
                  keys: const ['total_credit_bill', 'credit_bill_total'],
                  icon: Icons.credit_score,
                  color: AppColors.kWarning,
                ),
              ),
            ],
          ),
          const SizedBox(height: 20),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('POS Reconciliation',
                      style: Theme.of(context).textTheme.titleMedium),
                  const SizedBox(height: 12),
                  reconciliation.when(
                    data: (data) => _JsonSummary(data: _payload(data)),
                    loading: () =>
                        const LoadingSkeleton(type: SkeletonType.list),
                    error: (error, _) => ErrorState(message: '$error'),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 20),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Python POS Insights',
                      style: Theme.of(context).textTheme.titleMedium),
                  const SizedBox(height: 12),
                  insights.when(
                    data: (data) => data.isEmpty
                        ? const EmptyState(
                            message: 'Insights service unavailable')
                        : _JsonSummary(data: _payload(data)),
                    loading: () =>
                        const LoadingSkeleton(type: SkeletonType.list),
                    error: (_, __) => const EmptyState(
                        message: 'Insights service unavailable'),
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

class _BillsScaffold extends StatelessWidget {
  const _BillsScaffold({
    required this.title,
    required this.status,
    required this.onStatusChanged,
    required this.onSearch,
    required this.onExport,
    required this.child,
  });

  final String title;
  final String status;
  final ValueChanged<String?> onStatusChanged;
  final ValueChanged<String> onSearch;
  final VoidCallback onExport;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Column(
        children: [
          Row(
            children: [
              Expanded(
                  child: Text(title,
                      style: Theme.of(context).textTheme.titleLarge)),
              SizedBox(
                width: 220,
                child: TextField(
                  onChanged: onSearch,
                  decoration: const InputDecoration(
                    isDense: true,
                    prefixIcon: Icon(Icons.search, size: 18),
                    labelText: 'Search',
                  ),
                ),
              ),
              const SizedBox(width: 12),
              DropdownButton<String>(
                value: status,
                items: const [
                  DropdownMenuItem(value: 'all', child: Text('All')),
                  DropdownMenuItem(value: 'pending', child: Text('Pending')),
                  DropdownMenuItem(value: 'active', child: Text('Active')),
                  DropdownMenuItem(value: 'partial', child: Text('Partial')),
                  DropdownMenuItem(value: 'paid', child: Text('Paid')),
                  DropdownMenuItem(
                      value: 'cancelled', child: Text('Cancelled')),
                ],
                onChanged: onStatusChanged,
              ),
              const SizedBox(width: 12),
              OutlinedButton.icon(
                onPressed: onExport,
                icon: const Icon(Icons.download, size: 16),
                label: const Text('Export'),
              ),
            ],
          ),
          const SizedBox(height: 16),
          child,
        ],
      ),
    );
  }
}

class _BillList extends StatelessWidget {
  const _BillList({
    required this.rows,
    required this.emptyMessage,
    this.onPay,
  });

  final List<Map<String, dynamic>> rows;
  final String emptyMessage;

  /// When null, no payment action is shown (e.g. credit bills are settled by
  /// the branch accountant, not the cashier).
  final ValueChanged<Map<String, dynamic>>? onPay;

  @override
  Widget build(BuildContext context) {
    if (rows.isEmpty) return EmptyState(message: emptyMessage);
    return Card(
      child: ListView.separated(
        shrinkWrap: true,
        physics: const NeverScrollableScrollPhysics(),
        itemCount: rows.length,
        separatorBuilder: (_, __) => const Divider(height: 1),
        itemBuilder: (_, index) {
          final row = rows[index];
          final status = _text(row, ['status', 'approval_status']);
          final items = _billItems(row);
          return ExpansionTile(
            leading: CircleAvatar(
              backgroundColor: _statusColor(status).withValues(alpha: 0.12),
              child: Icon(Icons.receipt_long,
                  color: _statusColor(status), size: 18),
            ),
            title: Text(_text(row, [
              'order_number',
              'bill_number',
              'credit_number',
              'invoice_number',
              'id'
            ])),
            subtitle: Text(
              [
                if (_text(row, ['short_code', 'scan_reference']).isNotEmpty)
                  'Code ${_text(row, ['short_code', 'scan_reference'])}',
                if (_text(row, ['waiter_name']).isNotEmpty)
                  'Waiter ${_text(row, ['waiter_name'])}',
                if (_text(row, ['customer_name', 'guest_name']).isNotEmpty)
                  _text(row, ['customer_name', 'guest_name']),
                status,
              ].join(' - '),
            ),
            trailing: Text(
              _money(row['balance_amount'] ??
                  row['balance'] ??
                  row['total_amount']),
              style: const TextStyle(fontWeight: FontWeight.bold),
            ),
            childrenPadding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
            children: [
              _KeyValueGrid(values: {
                'Type': _text(row, ['bill_type', 'reference_type']),
                'Order': _text(row, ['order_number', 'bill_number']),
                'Short code': _text(row, ['short_code', 'scan_reference']),
                'Date': _date(row['bill_date'] ?? row['created_at']),
                'Total': _money(row['total_amount'] ?? row['amount']),
                'Paid': _money(row['paid_amount'] ?? row['amount_paid']),
                'Balance': _money(row['balance_amount'] ?? row['balance']),
                'Due': _date(row['due_date']),
              }),
              if (items.isNotEmpty) ...[
                const SizedBox(height: 12),
                Align(
                  alignment: Alignment.centerLeft,
                  child: Text('Items',
                      style: Theme.of(context).textTheme.titleSmall),
                ),
                const SizedBox(height: 6),
                for (final item in items)
                  ListTile(
                    dense: true,
                    contentPadding: EdgeInsets.zero,
                    title: Text(_text(item,
                        ['item_name', 'name', 'description', 'drink_name'])),
                    trailing: Text(
                      '${_num(item['quantity'] ?? item['qty']).toStringAsFixed(0)} x ${_money(item['unit_price'] ?? item['price'])}',
                    ),
                    subtitle: Text(_money(item['total_price'] ??
                        item['line_total'] ??
                        item['total'])),
                  ),
              ],
              const SizedBox(height: 8),
              if (onPay != null)
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    OutlinedButton.icon(
                      onPressed: () => onPay!(row),
                      icon: const Icon(Icons.payments, size: 16),
                      label: const Text('Confirm Payment'),
                    ),
                  ],
                ),
            ],
          );
        },
      ),
    );
  }
}

class _BillSummary extends StatelessWidget {
  const _BillSummary({required this.bill, required this.onCopyReference});

  final Map<String, dynamic> bill;
  final VoidCallback? onCopyReference;

  @override
  Widget build(BuildContext context) {
    final financials = _asMap(bill['financials']);
    final items = _billItems(bill);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Expanded(
              child: Text(
                _billTitle(bill),
                style:
                    const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
              ),
            ),
            if (onCopyReference != null)
              IconButton(
                onPressed: onCopyReference,
                icon: const Icon(Icons.copy, size: 18),
              ),
          ],
        ),
        const SizedBox(height: 8),
        _KeyValueGrid(values: {
          'Type': _text(bill, ['type', 'source']),
          'Customer': _customerName(bill),
          'Total': _money(financials['total_amount'] ?? bill['total_amount']),
          'Paid': _money(financials['amount_paid'] ?? bill['amount_paid']),
          'Balance': _money(financials['balance'] ?? bill['balance']),
          'Status': _text(bill, ['payment_status', 'status']),
        }),
        if (items.isNotEmpty) ...[
          const SizedBox(height: 16),
          const Text('Items', style: TextStyle(fontWeight: FontWeight.bold)),
          const SizedBox(height: 6),
          ListView.separated(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            itemCount: items.length,
            separatorBuilder: (_, __) => const Divider(height: 1),
            itemBuilder: (_, index) {
              final item = items[index];
              return ListTile(
                dense: true,
                contentPadding: EdgeInsets.zero,
                title: Text(_text(item, ['name', 'description', 'item_name'])),
                subtitle: Text('Qty ${_num(item['quantity'] ?? item['qty'])}'),
                trailing: Text(_money(
                    item['total'] ?? item['line_total'] ?? item['price'])),
              );
            },
          ),
        ],
      ],
    );
  }
}

class _MpesaMatches extends StatelessWidget {
  const _MpesaMatches({required this.matches, required this.onUse});

  final List<Map<String, dynamic>> matches;
  final ValueChanged<Map<String, dynamic>> onUse;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('M-Pesa Matches',
                style: TextStyle(fontWeight: FontWeight.bold)),
            const SizedBox(height: 8),
            ...matches.map(
              (match) => ListTile(
                dense: true,
                title: Text(_text(match,
                    ['receipt_number', 'mpesa_receipt_number', 'reference'])),
                subtitle: Text('${_text(match, [
                      'phone_number',
                      'phone'
                    ])} - ${_date(match['created_at'])}'),
                trailing: TextButton(
                  onPressed: () => onUse(match),
                  child: const Text('Use'),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _KeyValueGrid extends StatelessWidget {
  const _KeyValueGrid({required this.values});

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
                        fontSize: 11, color: AppColors.kTextSecondary),
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

class _AsyncStatCard extends StatelessWidget {
  const _AsyncStatCard({
    required this.value,
    required this.label,
    required this.keys,
    required this.icon,
    required this.color,
  });

  final AsyncValue<Map<String, dynamic>> value;
  final String label;
  final List<String> keys;
  final IconData icon;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return value.when(
      data: (data) {
        final s = _payload(data);
        final amount = keys.map((key) => s[key]).firstWhere(
              (item) => item != null,
              orElse: () => 0,
            );
        return StatCard(
            label: label, value: _money(amount), icon: icon, color: color);
      },
      loading: () => const LoadingSkeleton(type: SkeletonType.card),
      error: (_, __) =>
          StatCard(label: label, value: '-', icon: icon, color: color),
    );
  }
}

class _JsonSummary extends StatelessWidget {
  const _JsonSummary({required this.data});

  final Map<String, dynamic> data;

  @override
  Widget build(BuildContext context) {
    final entries = data.entries.take(20).toList();
    if (entries.isEmpty) return const EmptyState(message: 'No data');
    return _KeyValueGrid(
      values: {
        for (final entry in entries)
          entry.key: entry.value is num
              ? _money(entry.value)
              : readableRecordValue(data, entry.key, entry.value),
      },
    );
  }
}

class _PaymentDraftLine {
  _PaymentDraftLine({String? amount})
      : amountController = TextEditingController(text: amount ?? '');

  String method = 'cash';
  final TextEditingController amountController;
  final TextEditingController referenceController = TextEditingController();

  // Populated when method == 'credit_bill' (staff the credit is assigned to).
  String staffId = '';
  String staffName = '';

  num get amount => _num(amountController.text);

  Map<String, dynamic> toPayload() => {
        'payment_amount': amount,
        'payment_method': method,
        'payment_reference': referenceController.text.trim(),
        if (method == 'credit_bill') 'staff_id': staffId,
        if (method == 'credit_bill') 'staff_name': staffName,
      };

  void dispose() {
    amountController.dispose();
    referenceController.dispose();
  }
}

Future<Map<String, dynamic>?> _paymentPayload(
  BuildContext context,
  num amount, {
  String title = 'Record Payment',
  bool allowCreditBill = true,
  List<Map<String, dynamic>> staffMembers = const [],
}) {
  final staffOptions = _shiftStaffMembers(staffMembers);
  final lines = <_PaymentDraftLine>[
    _PaymentDraftLine(amount: amount > 0 ? amount.toStringAsFixed(0) : ''),
  ];
  return showDialog<Map<String, dynamic>>(
    context: context,
    builder: (context) => StatefulBuilder(
      builder: (context, setState) {
        final allocated = lines.fold<num>(0, (sum, line) => sum + line.amount);
        final remaining = amount - allocated;

        void addLine() {
          setState(() {
            lines.add(_PaymentDraftLine(
              amount: remaining > 0 ? remaining.toStringAsFixed(0) : '',
            ));
          });
        }

        Map<String, dynamic>? buildPayload() {
          // Credit-bill lines must have a staff member selected.
          for (final line in lines) {
            if (line.method == 'credit_bill' &&
                line.amount > 0 &&
                line.staffId.trim().isEmpty) {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(
                    content: Text(
                        'Select the staff member for the credit bill')),
              );
              return null;
            }
          }
          final payments = lines
              .map((line) => line.toPayload())
              .where((line) => _num(line['payment_amount']) > 0)
              .toList();
          final total = payments.fold<num>(
            0,
            (sum, payment) => sum + _num(payment['payment_amount']),
          );
          if (payments.isEmpty || total <= 0) {
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(
                  content: Text('Enter at least one payment amount')),
            );
            return null;
          }
          if (amount > 0 && total > amount) {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(
                content: Text(
                  'Payment exceeds balance by ${_money(total - amount)}',
                ),
              ),
            );
            return null;
          }
          if (payments.length == 1) return payments.first;
          return {
            'payment_amount': total,
            'payment_method': 'split',
            'payment_reference': payments
                .map((payment) => _text(payment, ['payment_reference']))
                .where((reference) => reference.isNotEmpty)
                .join(' / '),
            'payments': payments,
          };
        }

        return AlertDialog(
          title: Text(title),
          content: SizedBox(
            width: 620,
            child: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: AppColors.kSurface,
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: AppColors.kDivider),
                    ),
                    child: Wrap(
                      spacing: 16,
                      runSpacing: 8,
                      children: [
                        Text('Outstanding: ${_money(amount)}'),
                        Text('Allocated: ${_money(allocated)}'),
                        Text(
                          'Remaining: ${_money(remaining > 0 ? remaining : 0)}',
                          style: TextStyle(
                            color: remaining < 0
                                ? AppColors.kError
                                : AppColors.kTextSecondary,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 12),
                  for (var index = 0; index < lines.length; index++) ...[
                    _PaymentLineEditor(
                      line: lines[index],
                      canRemove: lines.length > 1,
                      allowCreditBill: allowCreditBill,
                      staffOptions: staffOptions,
                      onChanged: () => setState(() {}),
                      onRemove: () {
                        setState(() {
                          final removed = lines.removeAt(index);
                          removed.dispose();
                        });
                      },
                    ),
                    if (index != lines.length - 1) const SizedBox(height: 10),
                  ],
                  const SizedBox(height: 12),
                  OutlinedButton.icon(
                    onPressed: addLine,
                    icon: const Icon(Icons.add, size: 16),
                    label: const Text('Add payment method'),
                  ),
                  if (amount > 0 && remaining > 0) ...[
                    const SizedBox(height: 8),
                    Text(
                      'Saving less than the outstanding amount records a partial payment.',
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                            color: AppColors.kTextSecondary,
                          ),
                    ),
                  ],
                ],
              ),
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('Cancel'),
            ),
            ElevatedButton(
              onPressed: () {
                final payload = buildPayload();
                if (payload != null) Navigator.pop(context, payload);
              },
              child: const Text('Save'),
            ),
          ],
        );
      },
    ),
  ).whenComplete(() {
    for (final line in lines) {
      line.dispose();
    }
  });
}

class _PaymentLineEditor extends StatelessWidget {
  const _PaymentLineEditor({
    required this.line,
    required this.canRemove,
    required this.allowCreditBill,
    required this.staffOptions,
    required this.onChanged,
    required this.onRemove,
  });

  final _PaymentDraftLine line;
  final bool canRemove;
  final bool allowCreditBill;
  final List<_ShiftStaffMember> staffOptions;
  final VoidCallback onChanged;
  final VoidCallback onRemove;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: AppColors.kDivider),
      ),
      child: Column(
        children: [
          Row(
            children: [
              Expanded(
                flex: 5,
                child: TextField(
                  controller: line.amountController,
                  keyboardType: TextInputType.number,
                  onChanged: (_) => onChanged(),
                  decoration: const InputDecoration(
                    labelText: 'Amount',
                    isDense: true,
                  ),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                flex: 6,
                child: DropdownButtonFormField<String>(
                  initialValue: line.method,
                  isExpanded: true,
                  decoration: const InputDecoration(
                    labelText: 'Method',
                    isDense: true,
                  ),
                  items: [
                    const DropdownMenuItem(value: 'cash', child: Text('Cash')),
                    const DropdownMenuItem(
                        value: 'mpesa', child: Text('M-Pesa')),
                    const DropdownMenuItem(value: 'card', child: Text('Card')),
                    if (allowCreditBill)
                      const DropdownMenuItem(
                          value: 'credit_bill', child: Text('Credit Bill')),
                  ],
                  onChanged: (value) {
                    line.method = value ?? 'cash';
                    onChanged();
                  },
                ),
              ),
              if (canRemove) ...[
                const SizedBox(width: 6),
                IconButton(
                  tooltip: 'Remove payment line',
                  onPressed: onRemove,
                  icon: const Icon(Icons.close),
                ),
              ],
            ],
          ),
          if (line.method == 'credit_bill') ...[
            const SizedBox(height: 10),
            if (staffOptions.isEmpty)
              const Text(
                'No branch staff loaded — cannot assign a credit bill.',
                style: TextStyle(color: AppColors.kError, fontSize: 12),
              )
            else
              _StaffSearchField(
                staff: staffOptions,
                initialId: line.staffId.isEmpty ? null : line.staffId,
                onSelected: (selected) {
                  line.staffId = selected?.id ?? '';
                  line.staffName = selected?.name ?? '';
                  onChanged();
                },
              ),
          ],
          const SizedBox(height: 10),
          TextField(
            controller: line.referenceController,
            onChanged: (_) => onChanged(),
            decoration: InputDecoration(
              labelText:
                  line.method == 'cash' ? 'Reference (optional)' : 'Reference',
              isDense: true,
            ),
          ),
        ],
      ),
    );
  }
}

List<Map<String, dynamic>> _paymentLinesFromPayload(
    Map<String, dynamic> payload) {
  final rawPayments = payload['payments'];
  if (rawPayments is List) {
    return rawPayments
        .whereType<Map>()
        .map((payment) => Map<String, dynamic>.from(payment))
        .where((payment) => _num(payment['payment_amount']) > 0)
        .toList();
  }
  return [payload]
      .where((payment) => _num(payment['payment_amount']) > 0)
      .toList();
}

Future<Map<String, dynamic>?> _creditBillPayload(
  BuildContext context,
  num amount, {
  bool allowAmountEdit = false,
  List<Map<String, dynamic>> staffMembers = const [],
  _ShiftStaffMember? initialStaff,
  String? initialRemarks,
}) {
  final staffIdController = TextEditingController();
  final staffNameController = TextEditingController();
  final employeeIdController = TextEditingController();
  final departmentController = TextEditingController();
  final amountController =
      TextEditingController(text: amount > 0 ? amount.toStringAsFixed(0) : '');
  final monthsController = TextEditingController(text: '1');
  final remarksController = TextEditingController(text: initialRemarks ?? '');
  final staffOptions = _shiftStaffMembers(staffMembers);
  String billType = 'cashier_payment';
  String? errorText;
  final initialStaffId = initialStaff?.id ?? '';
  if (initialStaff != null) {
    staffIdController.text = initialStaff.id;
    staffNameController.text = initialStaff.name;
    employeeIdController.text = initialStaff.employeeId;
    departmentController.text = initialStaff.department;
  }
  return showDialog<Map<String, dynamic>>(
    context: context,
    builder: (context) => StatefulBuilder(
      builder: (context, setState) => AlertDialog(
        title: const Text('Credit Bill'),
        content: SizedBox(
          width: 520,
          child: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                if (errorText != null) ...[
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: AppColors.kError.withValues(alpha: 0.08),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Text(
                      errorText!,
                      style: const TextStyle(color: AppColors.kError),
                    ),
                  ),
                  const SizedBox(height: 12),
                ],
                if (staffOptions.isEmpty)
                  TextField(
                      controller: staffIdController,
                      decoration:
                          const InputDecoration(labelText: 'Staff profile ID'))
                else
                  _StaffSearchField(
                    staff: staffOptions,
                    initialId: initialStaffId.isEmpty ? null : initialStaffId,
                    label: 'Branch staff member (search)',
                    onSelected: (selected) {
                      setState(() {
                        staffIdController.text = selected?.id ?? '';
                        staffNameController.text = selected?.name ?? '';
                        employeeIdController.text = selected?.employeeId ?? '';
                        departmentController.text = selected?.department ?? '';
                        errorText = null;
                      });
                    },
                  ),
                const SizedBox(height: 12),
                TextField(
                    controller: staffNameController,
                    readOnly: staffOptions.isNotEmpty,
                    decoration: const InputDecoration(labelText: 'Staff name')),
                const SizedBox(height: 12),
                TextField(
                    controller: employeeIdController,
                    readOnly: staffOptions.isNotEmpty,
                    decoration:
                        const InputDecoration(labelText: 'Employee ID')),
                const SizedBox(height: 12),
                TextField(
                    controller: departmentController,
                    readOnly: staffOptions.isNotEmpty,
                    decoration: const InputDecoration(labelText: 'Department')),
                const SizedBox(height: 12),
                DropdownButtonFormField<String>(
                  initialValue: billType,
                  decoration: const InputDecoration(labelText: 'Bill type'),
                  items: const [
                    DropdownMenuItem(
                        value: 'cashier_payment',
                        child: Text('Cashier Payment')),
                    DropdownMenuItem(
                        value: 'restaurant', child: Text('Restaurant')),
                    DropdownMenuItem(value: 'bar', child: Text('Bar')),
                    DropdownMenuItem(value: 'hotel', child: Text('Hotel')),
                    DropdownMenuItem(
                        value: 'conference', child: Text('Conference')),
                  ],
                  onChanged: (value) =>
                      setState(() => billType = value ?? 'cashier_payment'),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: amountController,
                  enabled: allowAmountEdit || amount <= 0,
                  keyboardType: TextInputType.number,
                  decoration: const InputDecoration(labelText: 'Amount'),
                ),
                const SizedBox(height: 12),
                TextField(
                    controller: monthsController,
                    keyboardType: TextInputType.number,
                    decoration:
                        const InputDecoration(labelText: 'Deduction months')),
                const SizedBox(height: 12),
                TextField(
                    controller: remarksController,
                    decoration: const InputDecoration(labelText: 'Remarks')),
              ],
            ),
          ),
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('Cancel')),
          ElevatedButton(
            onPressed: () {
              final total =
                  num.tryParse(amountController.text.trim()) ?? amount;
              if (staffIdController.text.trim().isEmpty) {
                setState(() => errorText =
                    'Select the staff member for this credit bill.');
                return;
              }
              if (staffNameController.text.trim().isEmpty) {
                setState(() => errorText = 'Staff name is required.');
                return;
              }
              if (total <= 0) {
                setState(() => errorText =
                    'Credit bill amount must be greater than zero.');
                return;
              }
              Navigator.pop(context, {
                'staff_id': staffIdController.text.trim(),
                'staff_name': staffNameController.text.trim(),
                'employee_id': employeeIdController.text.trim(),
                'department': departmentController.text.trim(),
                'bill_type': billType,
                'reference_type': 'cashier_payment',
                'total_amount': total,
                'due_date':
                    _dateOnly(DateTime.now().add(const Duration(days: 30))),
                'payment_method': 'credit_bill',
                'deduction_months':
                    int.tryParse(monthsController.text.trim()) ?? 1,
                'remarks': remarksController.text.trim(),
              });
            },
            child: const Text('Create Credit'),
          ),
        ],
      ),
    ),
  ).whenComplete(() {
    staffIdController.dispose();
    staffNameController.dispose();
    employeeIdController.dispose();
    departmentController.dispose();
    amountController.dispose();
    monthsController.dispose();
    remarksController.dispose();
  });
}

Future<num?> _quantityDialog(BuildContext context, String itemName) {
  final qtyController = TextEditingController(text: '1');
  return showDialog<num>(
    context: context,
    builder: (context) => AlertDialog(
      title: Text('Add $itemName'),
      content: SizedBox(
        width: 320,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
                controller: qtyController,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(labelText: 'Quantity')),
          ],
        ),
      ),
      actions: [
        TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancel')),
        ElevatedButton(
          onPressed: () {
            final qty = num.tryParse(qtyController.text.trim()) ?? 1;
            Navigator.pop(context, qty);
          },
          child: const Text('Add'),
        ),
      ],
    ),
  ).whenComplete(() {
    qtyController.dispose();
  });
}

Future<num?> _numberDialog(BuildContext context, String title, String label) {
  final controller = TextEditingController();
  return showDialog<num>(
    context: context,
    builder: (context) => AlertDialog(
      title: Text(title),
      content: TextField(
        controller: controller,
        keyboardType: TextInputType.number,
        decoration: InputDecoration(labelText: label),
      ),
      actions: [
        TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancel')),
        ElevatedButton(
          onPressed: () =>
              Navigator.pop(context, num.tryParse(controller.text.trim()) ?? 0),
          child: const Text('Save'),
        ),
      ],
    ),
  ).whenComplete(controller.dispose);
}

Map<String, dynamic> _payload(dynamic data) {
  final map = _asMap(data);
  final inner = map['data'];
  if (inner is Map<String, dynamic>) return inner;
  if (inner is Map) return Map<String, dynamic>.from(inner);
  return map;
}

Map<String, dynamic> _asMap(dynamic value) {
  if (value is Map<String, dynamic>) return value;
  if (value is Map) return Map<String, dynamic>.from(value);
  return {};
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

String _shiftStatus(Map<String, dynamic> row) =>
    _text(row, ['status']).toLowerCase();

String _statusLabel(String status) {
  switch (status.toLowerCase()) {
    case 'pending_open':
      return 'Pending Approval';
    case 'open':
      return 'Open';
    case 'closed':
      return 'Closed';
    case 'reconciled':
      return 'Reconciled';
    case 'verified':
      return 'Verified';
    default:
      return 'Recent';
  }
}

num _num(dynamic value) {
  if (value is num) return value;
  return num.tryParse(value?.toString() ?? '') ?? 0;
}

String _money(dynamic value) {
  final amount = _num(value);
  return NumberFormat.currency(symbol: 'KES ', decimalDigits: 0).format(amount);
}

// Extract the staff credit-bill breakdown attached to a shift row.
List<Map<String, dynamic>> _creditBillDetails(Map<String, dynamic> row) {
  final raw = row['credit_bills_details'] ?? row['credit_details'];
  if (raw is List) {
    return raw
        .whereType<Map>()
        .map((e) => Map<String, dynamic>.from(e))
        .where((e) => _num(e['amount'] ?? e['total_amount']) > 0)
        .toList();
  }
  return const [];
}

// Open-shift count from cashier stats: backend returns the cashier's own open
// shift as `activeShift` (object or null); fall back to numeric count keys.
int _openShiftCount(Map<String, dynamic> s) {
  if (s['open_shifts'] != null) return _num(s['open_shifts']).toInt();
  if (s['active_shifts'] != null) return _num(s['active_shifts']).toInt();
  final active = s['activeShift'] ?? s['active_shift'];
  if (active is Map) return active.isNotEmpty ? 1 : 0;
  return active != null ? 1 : 0;
}

String _date(dynamic value) {
  if (value == null || value.toString().isEmpty) return '-';
  final parsed = DateTime.tryParse(value.toString());
  if (parsed == null) return value.toString();
  return DateFormat('MMM d, yyyy HH:mm').format(parsed.toLocal());
}

String _dateOnly(DateTime date) =>
    '${date.year}-${date.month.toString().padLeft(2, '0')}-${date.day.toString().padLeft(2, '0')}';

Color _statusColor(String status) {
  switch (status.toLowerCase()) {
    case 'paid':
    case 'completed':
    case 'reconciled':
    case 'confirmed':
      return AppColors.kSuccess;
    case 'open':
    case 'active':
    case 'partial':
      return AppColors.kPrimary;
    case 'pending_open':
      return AppColors.kWarning;
    case 'cancelled':
    case 'failed':
    case 'rejected':
      return AppColors.kError;
    default:
      return AppColors.kWarning;
  }
}

String _receiptMethodLabel(String method) {
  final normalized = method.toUpperCase().replaceAll('-', '_');
  if (normalized.contains('SPLIT')) return 'SPLIT PAYMENT';
  if (normalized.contains('MPESA')) return 'M-PESA';
  if (normalized.contains('CARD')) return 'CARD';
  if (normalized.contains('CREDIT')) return 'CREDIT BILL';
  if (normalized.contains('CASH')) return 'CASH';
  return normalized;
}

String _backendPaymentMethod(String method) {
  final normalized = method.toLowerCase().replaceAll('-', '_');
  if (normalized.contains('mpesa')) return 'mpesa';
  if (normalized.contains('card')) return 'card';
  if (normalized.contains('credit')) return 'credit_bill';
  return normalized.isEmpty ? 'cash' : normalized;
}

String _receiptReferenceForPayment(Map<String, dynamic> payment) {
  final method = _receiptMethodLabel(_text(payment, ['payment_method']));
  final amount = _num(payment['payment_amount']);
  final reference = _text(payment, ['payment_reference', 'reference']);
  return '$method ${_money(amount)}${reference.isEmpty ? '' : ' ($reference)'}';
}

Future<void> _printCashierBillReceipt({
  required WidgetRef ref,
  required Map<String, dynamic> bill,
  required num amount,
  required String method,
  required Map<String, dynamic> response,
  required String fallbackReference,
  String? receiptType,
}) async {
  final payload = _payload(response);
  final data = _payload(payload['data']);
  final reference =
      _text(data, ['reference', 'transaction_number', 'id']).isNotEmpty
          ? _text(data, ['reference', 'transaction_number', 'id'])
          : fallbackReference;
  final nav = ref.read(dashboardNavProvider);
  final methodLabel = _receiptMethodLabel(method);
  await PrintService().printReceipt(
    SaleResult(
      transactionId: reference.isEmpty ? DateTime.now().toString() : reference,
      createdAt: DateTime.now(),
      receiptNumber: reference.isEmpty ? null : reference,
      cashierName: nav.user?.name,
      total: amount.toDouble(),
      paymentMethod: methodLabel,
    ),
    _receiptItemsFromBill(bill, amount),
    nav.branchName,
    receiptType: receiptType ?? '$methodLabel RECEIPT',
    customerName: _customerName(bill),
    publicCode: _text(bill, [
      'short_code',
      'shortCode',
      'bill_number',
      'order_number',
      'invoice_number'
    ]),
  );
}

List<CartItem> _receiptItemsFromBill(Map<String, dynamic> bill, num amount) {
  final items = _billItems(bill)
      .map((item) {
        final quantity = (_num(item['quantity'] ?? item['qty'])).round();
        final total = _num(item['total'] ??
            item['total_price'] ??
            item['line_total'] ??
            item['amount']);
        final unitPrice = _num(item['unit_price'] ?? item['price']);
        final name = _text(
          item,
          ['name', 'description', 'item_name', 'drink_name'],
        );
        if (name.isEmpty) return null;
        return CartItem(
          productId: _text(item, ['product_id', 'id']),
          name: name,
          unitPrice: unitPrice > 0
              ? unitPrice.toDouble()
              : (quantity > 0
                  ? (total / quantity).toDouble()
                  : total.toDouble()),
          qty: quantity > 0 ? quantity : 1,
        );
      })
      .whereType<CartItem>()
      .toList();
  if (items.isNotEmpty) return items;
  return [
    CartItem(
      productId: _text(bill, ['id']),
      name: _billTitle(bill),
      unitPrice: amount.toDouble(),
      qty: 1,
    ),
  ];
}

String _billTitle(Map<String, dynamic> bill) {
  for (final key in [
    'short_code',
    'shortCode',
    'booking_id',
    'bookingId',
    'order_number',
    'invoice_number',
    'transaction_ref',
    'bill_number'
  ]) {
    final direct = bill[key];
    if (direct != null) return direct.toString();
  }
  for (final nestedKey in [
    'booking',
    'order',
    'invoice',
    'transaction',
    'bill'
  ]) {
    final nested = _asMap(bill[nestedKey]);
    final value = _text(nested, [
      'short_code',
      'shortCode',
      'booking_number',
      'order_number',
      'invoice_number',
      'transaction_ref',
      'bill_number',
      'id'
    ]);
    if (value.isNotEmpty) return value;
  }
  return _text(bill, ['id', 'type']);
}

String _customerName(Map<String, dynamic> bill) {
  final direct = _text(bill, ['customer_name', 'guest_name', 'staff_name']);
  if (direct.isNotEmpty) return direct;
  for (final nestedKey in [
    'customer',
    'guest',
    'booking',
    'order',
    'invoice',
    'bill'
  ]) {
    final nested = _asMap(bill[nestedKey]);
    final value =
        _text(nested, ['customer_name', 'guest_name', 'name', 'staff_name']);
    if (value.isNotEmpty) return value;
  }
  return 'Walk-in';
}

double _balanceFromBill(Map<String, dynamic>? bill) {
  if (bill == null) return 0;
  final financials = _asMap(bill['financials']);
  return _num(
          financials['balance'] ?? bill['balance'] ?? bill['balance_amount'])
      .toDouble();
}

List<Map<String, dynamic>> _billItems(Map<String, dynamic> bill) {
  for (final key in ['items', 'line_items']) {
    final direct = bill[key];
    if (direct is List) {
      return direct
          .whereType<Map>()
          .map((item) => Map<String, dynamic>.from(item))
          .toList();
    }
  }
  for (final nestedKey in [
    'booking',
    'order',
    'invoice',
    'bill',
    'transaction'
  ]) {
    final nested = _asMap(bill[nestedKey]);
    final nestedItems = nested['items'] ?? nested['line_items'];
    if (nestedItems is List) {
      return nestedItems
          .whereType<Map>()
          .map((item) => Map<String, dynamic>.from(item))
          .toList();
    }
  }
  return const [];
}
