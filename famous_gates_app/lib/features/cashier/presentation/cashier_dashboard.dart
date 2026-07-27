import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:mobile_scanner/mobile_scanner.dart';

import '../../../core/powersync/powersync_service.dart';
import '../../../core/realtime/realtime_service.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/storage/secure_storage_provider.dart';
import '../../../core/utils/api_error_message.dart';
import '../../../core/utils/readable_record.dart';
import '../../../core/widgets/widgets.dart';
import '../../../services/print_service.dart';
import '../../auth/data/auth_repository.dart';
import '../../kitchen/domain/models.dart' show KitchenOrder;
import '../../pos/domain/models.dart';
import '../../templates/data/document_printer.dart';
import '../../pos/data/outlet_pos_repository.dart';
import '../data/cashier_repository.dart';
import '../domain/providers.dart';

// Only these station roles handle Main Bar / Executive Bar captain orders;
// every other cashier role (reception, restaurant, non-consumables, etc.)
// must stay silent so the same bar ticket isn't auto-printed everywhere.
const _kBarCaptainOrderCashierRoles = {
  'main_bar_cashier',
  'executive_bar_cashier',
};

enum CashierTab {
  station,
  pos,
  bills,
  voidRequests,
  exchangeRequests,
  voided,
  credit,
  expenses,
  shifts,
  barcode
}

class CashierDashboard extends ConsumerStatefulWidget {
  const CashierDashboard({
    super.key,
    this.initialTab = CashierTab.station,
    this.initialBillRef,
    this.initialAmount,
    this.initialMethod,
    this.embedded = false,
  });

  final CashierTab initialTab;

  /// Optional pre-fill when navigated from another module (e.g. reception
  /// checkout): bill reference to auto-load, amount, and payment method.
  final String? initialBillRef;
  final String? initialAmount;
  final String? initialMethod;
  final bool embedded;

  @override
  ConsumerState<CashierDashboard> createState() => _CashierDashboardState();
}

class _CashierDashboardState extends ConsumerState<CashierDashboard> {
  static const _visibleTabs = [
    CashierTab.station,
    CashierTab.voidRequests,
    CashierTab.exchangeRequests,
    CashierTab.voided,
    CashierTab.credit,
    CashierTab.expenses,
    CashierTab.shifts,
  ];

  late int _tab = () {
    final index = _visibleTabs.indexOf(widget.initialTab);
    return index >= 0 ? index : 0;
  }();

  // Keeps the "Void Requests" / "Exchange Requests" tab badges fresh.
  // When Supabase Realtime is available the badges update instantly;
  // otherwise falls back to a 15-second poll (e.g. when PowerSync
  // hot-reads are enabled or branchId is unavailable at startup).
  StreamSubscription<VoidRequestRealtimeEvent>? _voidRealtimeSub;
  Timer? _voidBadgeTimer;

  @override
  void initState() {
    super.initState();
    _initVoidBadgeFeed();
  }

  Future<void> _initVoidBadgeFeed() async {
    // PowerSync handles realtime natively when hot-reads are on.
    if (ref.read(powerSyncHotReadsEnabledProvider)) return;

    final storage = ref.read(secureStorageProvider);
    final branchIdStr =
        await storage.read(key: AuthRepository.branchIdKey) ?? '';
    final branchId = int.tryParse(branchIdStr.trim());

    if (branchId != null) {
      final realtimeService = ref.read(realtimeServiceProvider);
      _voidRealtimeSub =
          realtimeService.watchVoidRequests(branchId).listen((event) {
        if (!mounted) return;
        debugPrint(
            '🔴 Cashier void badge Realtime: ${event.eventType} id=${event.id} status=${event.status}');
        ref.invalidate(cashierPendingItemVoidsProvider);
        ref.invalidate(cashierPendingExchangesProvider);
        ref.invalidate(cashierAwaitingRefundExchangesProvider);
      }, onError: (Object err) {
        debugPrint(
            '❌ Cashier void badge Realtime error: $err — falling back to polling');
        _startVoidBadgePolling();
      });
    } else {
      debugPrint(
          '⚠️ CashierDashboard: No branchId found — falling back to 15s badge polling.');
      _startVoidBadgePolling();
    }
  }

  void _startVoidBadgePolling() {
    _voidBadgeTimer?.cancel();
    _voidBadgeTimer = Timer.periodic(const Duration(seconds: 15), (_) {
      if (!mounted) return;
      ref.invalidate(cashierPendingItemVoidsProvider);
      ref.invalidate(cashierPendingExchangesProvider);
      ref.invalidate(cashierAwaitingRefundExchangesProvider);
    });
  }

  @override
  void dispose() {
    _voidRealtimeSub?.cancel();
    _voidBadgeTimer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final pendingVoidsCount =
        ref.watch(cashierPendingItemVoidsProvider).maybeWhen(
              data: (rows) => rows.length,
              orElse: () => 0,
            );
    final pendingExchangesCount =
        ref.watch(cashierPendingExchangesProvider).maybeWhen(
              data: (rows) => rows.length,
              orElse: () => 0,
            );
    final awaitingRefundCount =
        ref.watch(cashierAwaitingRefundExchangesProvider).maybeWhen(
              data: (rows) => rows.length,
              orElse: () => 0,
            );
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
        label: 'Void Management',
        icon: Icons.block,
        content: _RequiresOpenShift(child: _VoidManagementTab()),
      ),
      DashboardTab(
        label: 'Void Requests',
        icon: Icons.report_problem_outlined,
        badgeCount: pendingVoidsCount,
        content: const _VoidRequestsTab(),
      ),
      DashboardTab(
        label: 'Exchange Requests',
        icon: Icons.swap_horiz,
        badgeCount: pendingExchangesCount + awaitingRefundCount,
        content: const _ExchangeRequestsTab(),
      ),
      const DashboardTab(
        label: 'Voided Orders',
        icon: Icons.block,
        content: _RequiresOpenShift(child: _VoidedOrdersTab()),
      ),
      const DashboardTab(
        label: 'Paid Credits',
        icon: Icons.payments,
        content: _RequiresOpenShift(child: _PaidBillsTab()),
      ),
      const DashboardTab(
        label: 'Expenses',
        icon: Icons.receipt_long,
        content: _RequiresOpenShift(child: _ShiftExpensesTab()),
      ),
      const DashboardTab(
        label: 'Shifts',
        icon: Icons.access_time,
        content: _ShiftsTab(),
      ),
    ];

    if (widget.embedded) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(24, 20, 24, 8),
            child: Wrap(
              spacing: 12,
              runSpacing: 12,
              alignment: WrapAlignment.spaceBetween,
              children: [
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Reception Cashier',
                        style: Theme.of(context)
                            .textTheme
                            .headlineSmall
                            ?.copyWith(fontWeight: FontWeight.w800)),
                    const SizedBox(height: 4),
                    const Text(
                      'Cashier desk, bill lookup, payments, shifts and credit bills inside Reception.',
                      style: TextStyle(color: AppColors.kTextSecondary),
                    ),
                  ],
                ),
                OutlinedButton.icon(
                  onPressed: () {
                    ref.invalidate(cashierStatsProvider);
                    ref.invalidate(cashierReconciliationProvider);
                    ref.invalidate(cashierCurrentShiftProvider);
                  },
                  icon: const Icon(Icons.refresh, size: 16),
                  label: const Text('Refresh'),
                ),
              ],
            ),
          ),
          _EmbeddedCashierTabs(
            tabs: tabs,
            currentTab: _tab,
            onTabChanged: (index) => setState(() => _tab = index),
          ),
          Expanded(
            child: KeyedSubtree(
              key: ValueKey(
                  'embedded_cashier_${_tab}_${widget.initialBillRef ?? ''}_${widget.initialAmount ?? ''}_${widget.initialMethod ?? ''}'),
              child: tabs[_tab].content,
            ),
          ),
        ],
      );
    }

    return DashboardShell(
      title: 'Cashier Desk',
      currentTab: _tab,
      onTabChanged: (index) => setState(() => _tab = index),
      tabs: tabs,
      showBackButton: false,
      backgroundColor: const Color(0xFFEEF2F7),
      actions: [
        OutlinedButton.icon(
          onPressed: () {
            ref.invalidate(cashierStatsProvider);
            ref.invalidate(cashierReconciliationProvider);
            ref.invalidate(cashierCurrentShiftProvider);
          },
          icon: const Icon(Icons.refresh, size: 16),
          label: const Text('Refresh'),
        ),
      ],
    );
  }
}

class _EmbeddedCashierTabs extends StatelessWidget {
  const _EmbeddedCashierTabs({
    required this.tabs,
    required this.currentTab,
    required this.onTabChanged,
  });

  final List<DashboardTab> tabs;
  final int currentTab;
  final ValueChanged<int> onTabChanged;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.fromLTRB(24, 8, 24, 0),
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(
        color: AppColors.kSurface,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: AppColors.kDivider),
      ),
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        child: Row(
          children: [
            for (var index = 0; index < tabs.length; index++)
              Padding(
                padding: const EdgeInsets.only(right: 4),
                child: ChoiceChip(
                  selected: index == currentTab,
                  avatar: tabs[index].icon == null
                      ? null
                      : Icon(tabs[index].icon, size: 16),
                  label: Text(tabs[index].label),
                  onSelected: (_) => onTabChanged(index),
                ),
              ),
          ],
        ),
      ),
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
                        'Open a shift from the Shifts tab. Once the required stocktake(s) are submitted, your shift opens immediately — no branch accountant approval needed.',
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
  const _StationTab(
      {this.initialBillRef, this.initialAmount, this.initialMethod});

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
  final _tenderedController = TextEditingController();
  String _unpaidSearch = '';
  Timer? _unpaidSearchDebounce;
  String? _selectedUnpaidRef;
  String _method = 'cash';

  // Barcode scanner (merged into Station). Mode 'camera' uses the device
  // camera; 'hardware' keeps the lookup field focused for keyboard-wedge
  // scanners. Persisted per device via secure storage.
  static const _kScanModeKey = 'cashier_scanner_mode';
  static const _kScanAutoKey = 'cashier_scanner_autosubmit';
  String _scannerMode = 'camera';
  bool _scannerAutoSubmit = true;

  Future<void> _loadScannerConfig() async {
    final storage = ref.read(secureStorageProvider);
    final mode = await storage.read(key: _kScanModeKey);
    final auto = await storage.read(key: _kScanAutoKey);
    if (!mounted) return;
    setState(() {
      if (mode == 'hardware' || mode == 'camera') _scannerMode = mode!;
      if (auto != null) _scannerAutoSubmit = auto != 'false';
    });
  }

  Future<void> _saveScannerConfig() async {
    final storage = ref.read(secureStorageProvider);
    await storage.write(key: _kScanModeKey, value: _scannerMode);
    await storage.write(
        key: _kScanAutoKey, value: _scannerAutoSubmit ? 'true' : 'false');
  }

  Future<void> _scanWithCamera() async {
    final code = await Navigator.of(context).push<String>(
      MaterialPageRoute(builder: (_) => const _CashierBarcodeScannerScreen()),
    );
    if (!mounted || code == null || code.trim().isEmpty) return;
    _lookupController.text = code.trim();
    if (_scannerAutoSubmit) {
      _lookupBill();
    }
  }

  Future<void> _openScannerConfig() async {
    var mode = _scannerMode;
    var auto = _scannerAutoSubmit;
    final saved = await showDialog<bool>(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setLocal) => AlertDialog(
          title: const Text('Barcode Scanner Configuration'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text('Scanner mode',
                  style: TextStyle(fontWeight: FontWeight.w600)),
              const SizedBox(height: 8),
              SegmentedButton<String>(
                segments: const [
                  ButtonSegment(
                      value: 'camera',
                      label: Text('Camera'),
                      icon: Icon(Icons.qr_code_scanner)),
                  ButtonSegment(
                      value: 'hardware',
                      label: Text('Hardware'),
                      icon: Icon(Icons.usb)),
                ],
                selected: {mode},
                onSelectionChanged: (s) => setLocal(() => mode = s.first),
              ),
              const SizedBox(height: 6),
              Text(
                mode == 'hardware'
                    ? 'Keeps the lookup field focused for keyboard-wedge / USB scanners.'
                    : 'Use the device camera to scan barcodes.',
                style: const TextStyle(fontSize: 12, color: Colors.grey),
              ),
              const Divider(),
              SwitchListTile(
                contentPadding: EdgeInsets.zero,
                value: auto,
                onChanged: (v) => setLocal(() => auto = v),
                title: const Text('Auto-lookup after scan'),
                subtitle:
                    const Text('Immediately load the bill once a code is read'),
              ),
            ],
          ),
          actions: [
            TextButton(
                onPressed: () => Navigator.pop(ctx, false),
                child: const Text('Cancel')),
            FilledButton(
                onPressed: () => Navigator.pop(ctx, true),
                child: const Text('Save')),
          ],
        ),
      ),
    );
    if (saved == true && mounted) {
      setState(() {
        _scannerMode = mode;
        _scannerAutoSubmit = auto;
      });
      await _saveScannerConfig();
    }
  }

  /// Cash handed over by the customer (for computing change).
  num get _tendered => num.tryParse(_tenderedController.text.trim()) ?? 0;
  num get _amountDue => num.tryParse(_amountController.text.trim()) ?? 0;
  num get _changeDue => _tendered > _amountDue ? _tendered - _amountDue : 0;
  bool _loading = false;
  Map<String, dynamic>? _bill;
  List<Map<String, dynamic>> _mpesaMatches = const [];

  // Credit-bill staff selection (inline, searchable, branch-filtered).
  List<_ShiftStaffMember> _staffOptions = const [];
  _ShiftStaffMember? _selectedStaff;
  bool _staffLoading = false;

  Future<void> _loadStaff() async {
    if (_staffOptions.isNotEmpty || _staffLoading) return;
    setState(() => _staffLoading = true);
    final staff = await ref
        .read(cashierRepositoryProvider)
        .getBranchStaff()
        .catchError((_) => <Map<String, dynamic>>[]);
    if (!mounted) return;
    setState(() {
      _staffOptions = _shiftStaffMembers(staff);
      _staffLoading = false;
    });
  }

  // Main Bar / Executive Bar captain orders auto-printed at this cashier
  // station, mirroring the KDS backup-print pattern. Gated to bar cashier
  // roles only (see _kBarCaptainOrderCashierRoles) so reception/restaurant/
  // other cashier stations never auto-print bar tickets.
  Timer? _captainOrderTimer;
  final Set<String> _printedCaptainOrderIds = {};

  Future<void> _initBarCaptainOrderFeed() async {
    final storage = ref.read(secureStorageProvider);
    final role = (await storage.read(key: AuthRepository.roleKey) ?? '')
        .trim()
        .toLowerCase();
    if (!mounted || !_kBarCaptainOrderCashierRoles.contains(role)) return;
    _pollBarCaptainOrders();
    _captainOrderTimer = Timer.periodic(
        const Duration(seconds: 5), (_) => _pollBarCaptainOrders());
  }

  @override
  void initState() {
    super.initState();
    _loadScannerConfig();
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
    _initBarCaptainOrderFeed();
  }

  @override
  void dispose() {
    _captainOrderTimer?.cancel();
    _unpaidSearchDebounce?.cancel();
    _lookupController.dispose();
    _amountController.dispose();
    _referenceController.dispose();
    _mpesaPhoneController.dispose();
    _tenderedController.dispose();
    super.dispose();
  }

  /// Pulls Main Bar / Executive Bar captain orders (new + recalled) for the
  /// cashier's branch and auto-prints a copy as a backup, the same way the
  /// Kitchen Display auto-prints restaurant captain orders.
  Future<void> _pollBarCaptainOrders() async {
    try {
      final raw =
          await ref.read(cashierRepositoryProvider).getBarCaptainOrders();
      if (!mounted) return;
      final orders = raw.map(KitchenOrder.fromJson).toList();
      for (final order in orders) {
        final printKey = order.kdsPrintKey;
        if (_printedCaptainOrderIds.contains(printKey)) continue;

        // Skip if the server already has this order's current state marked
        // printed (by the backend's own attempt, or another cashier/KDS
        // screen). This is what actually survives a logout/login — the
        // in-memory set above only protects this one screen instance.
        if (order.captainOrderAlreadyPrinted) {
          _printedCaptainOrderIds.add(printKey);
          continue;
        }

        if (order.isVoided || order.hasPendingVoidRequest) continue;

        final status = order.status.toLowerCase();
        if (status != 'pending' &&
            status != 'confirmed' &&
            status != 'recalled') {
          continue;
        }

        // Mark as printed immediately to avoid duplicate printing. This is
        // deliberately NOT rolled back on a print failure below — a stuck
        // printer must not turn into this same order being retried on every
        // 5s poll (and again on every login) forever. Staff have a manual
        // reprint button for genuine misses.
        _printedCaptainOrderIds.add(printKey);
        final shiftId = order.shiftId;
        if (shiftId != null && shiftId.isNotEmpty) {
          ref.read(cashierRepositoryProvider).markBarCaptainOrderPrinted(
                shiftId: shiftId,
                orderId: order.id.replaceFirst('pos:', ''),
              );
        }

        _printBarCaptainOrder(order).then((_) {
          debugPrint(
              '✅ Bar captain order ${order.orderNumber} printed at cashier station');
        }).catchError((error) {
          debugPrint(
              '⚠️ Failed to print bar captain order ${order.orderNumber} at cashier station: $error');
        });
      }
    } catch (error) {
      debugPrint(
          '❌ Error polling bar captain orders at cashier station: $error');
    }
  }

  Future<void> _printBarCaptainOrder(KitchenOrder order) async {
    final printService = PrintService();
    final printItems =
        order.hasRecalledItems ? order.recalledItems : order.items;
    final printTotal = printItems.fold<double>(
      0,
      (sum, item) => sum + (item.unitPrice * item.quantity),
    );
    final effectiveTotal = printTotal > 0 ? printTotal : order.total;

    // The document header already says "RECALLED CAPTAIN ORDER" when
    // isRecall is true, so there's no need to also prefix every line.
    final cartItems = printItems.map((item) {
      return CartItem(
        productId: item.id,
        name: [
          item.name,
          if (item.notes != null && item.notes!.trim().isNotEmpty)
            '[${item.notes}]',
        ].join(' '),
        unitPrice: item.unitPrice,
        qty: item.quantity,
      );
    }).toList();

    final saleResult = SaleResult(
      transactionId: order.id,
      receiptNumber: order.shortCode ?? order.orderNumber,
      total: effectiveTotal,
      paymentMethod: 'PENDING',
      cashierName: order.waiterName ?? 'Waiter',
      createdAt: order.effectiveCreatedAt,
    );

    await printService.printCaptainOrder(
      sale: saleResult,
      items: cartItems,
      branchName: 'FamousGate Hotels',
      orderNumber: order.hasRecalledItems
          ? '${order.orderNumber} RECALL'
          : order.orderNumber,
      shortCode: order.shortCode,
      tableNumber: order.tableNumber?.toString(),
      roomNumber: order.roomNumber,
      customerName: order.customerName,
      waiterName: order.waiterName,
      orderType: order.orderTypeLabel,
      isRecall: order.hasRecalledItems,
      outletType: order.outletType,
    );
  }

  @override
  Widget build(BuildContext context) {
    final currentShift = ref.watch(cashierCurrentShiftProvider);
    final unpaidBills = ref.watch(
        cashierUnpaidBillsProvider(CashierBillFilters(search: _unpaidSearch)));
    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          currentShift.when(
            data: (raw) {
              final shift = _payload(raw);
              // Financial totals are deliberately hidden from the cashier
              // during an active shift. Only the accountant sees real
              // collections at reconciliation time.
              final txns = _num(shift['transaction_count']).toInt();
              final unpaidCount = unpaidBills.maybeWhen(
                  data: (bills) => bills.length, orElse: () => null);
              return Row(
                children: [
                  const Expanded(
                    child: StatCard(
                      label: 'Shift Collections',
                      // Hidden from cashier — revealed at reconciliation
                      value: 'KES 0',
                      icon: Icons.payments,
                      color: AppColors.kSuccess,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: StatCard(
                      label: 'Unpaid Bills',
                      // Show count only — no amount visible to cashier
                      value: unpaidCount == null
                          ? '...'
                          : '$unpaidCount bill${unpaidCount == 1 ? '' : 's'}',
                      icon: Icons.receipt_long,
                      color: AppColors.kWarning,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: StatCard(
                      label: 'Shift Transactions',
                      value: '$txns',
                      icon: Icons.access_time,
                      color: AppColors.kPrimary,
                    ),
                  ),
                  const SizedBox(width: 12),
                  const Expanded(
                    child: StatCard(
                      label: 'Expected Drawer Cash',
                      // Hidden from cashier — revealed at reconciliation
                      value: 'KES 0',
                      icon: Icons.account_balance_wallet,
                      color: AppColors.kAccent,
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
              Expanded(
                flex: 2,
                child: Column(
                  children: [
                    _lookupPanel(),
                    const SizedBox(height: 16),
                    _unpaidQueuePanel(unpaidBills),
                  ],
                ),
              ),
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
            Row(
              children: [
                Expanded(
                  child: Text(
                    'Bill Lookup & Barcode',
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                ),
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                  decoration: BoxDecoration(
                    color: AppColors.kPrimary.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Text(
                    _scannerMode == 'hardware' ? 'Hardware scanner' : 'Camera',
                    style: const TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                        color: AppColors.kPrimary),
                  ),
                ),
                IconButton(
                  icon: const Icon(Icons.settings, size: 20),
                  onPressed: _openScannerConfig,
                ),
              ],
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _lookupController,
              autofocus: _scannerMode == 'hardware',
              onSubmitted: (_) => _lookupBill(),
              decoration: InputDecoration(
                labelText:
                    'Order number, short code, barcode, invoice, booking, POS ref',
                prefixIcon: const Icon(Icons.search),
                suffixIcon: IconButton(
                  icon: const Icon(Icons.qr_code_scanner),
                  onPressed: _loading ? null : _scanWithCamera,
                ),
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
                OutlinedButton.icon(
                  onPressed: _loading ? null : _scanWithCamera,
                  icon: const Icon(Icons.qr_code_scanner, size: 16),
                  label: const Text('Scan'),
                ),
                const SizedBox(width: 8),
                OutlinedButton(
                  onPressed: () {
                    setState(() {
                      _bill = null;
                      _selectedUnpaidRef = null;
                      _lookupController.clear();
                      _amountController.clear();
                      _referenceController.clear();
                      _tenderedController.clear();
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

  Widget _unpaidQueuePanel(AsyncValue<List<Map<String, dynamic>>> unpaidBills) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    'Unpaid Bills for Clearance',
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                ),
                IconButton(
                  onPressed: () => ref.invalidate(cashierUnpaidBillsProvider),
                  icon: const Icon(Icons.refresh, size: 18),
                ),
              ],
            ),
            const SizedBox(height: 10),
            TextField(
              onChanged: (value) {
                _unpaidSearchDebounce?.cancel();
                _unpaidSearchDebounce = Timer(
                  const Duration(milliseconds: 300),
                  () => setState(() => _unpaidSearch = value),
                );
              },
              decoration: const InputDecoration(
                labelText: 'Search by short code, waiter, order no. or table…',
                prefixIcon: Icon(Icons.search),
              ),
            ),
            const SizedBox(height: 12),
            unpaidBills.when(
              data: (rows) {
                if (rows.isEmpty) {
                  return const EmptyState(message: 'No unpaid bills to clear');
                }
                return ListView.separated(
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  itemCount: rows.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 8),
                  itemBuilder: (context, index) {
                    final row = rows[index];
                    final refText = _billLookupReference(row);
                    final selected =
                        refText.isNotEmpty && refText == _selectedUnpaidRef;
                    final balance = _num(row['balance_amount'] ??
                        row['balance'] ??
                        row['total_amount']);
                    final customer = _customerName(row);
                    return InkWell(
                      borderRadius: BorderRadius.circular(12),
                      onTap: _loading ? null : () => _loadUnpaidBill(row),
                      child: Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: selected
                              ? AppColors.kPrimary.withValues(alpha: 0.08)
                              : AppColors.kSurface,
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(
                            color: selected
                                ? AppColors.kPrimary
                                : AppColors.kDivider,
                          ),
                        ),
                        child: Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            CircleAvatar(
                              radius: 18,
                              backgroundColor:
                                  AppColors.kWarning.withValues(alpha: 0.12),
                              child: const Icon(Icons.receipt_long,
                                  color: AppColors.kWarning, size: 18),
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Row(
                                    children: [
                                      Expanded(
                                        child: Text(
                                          _billTitle(row),
                                          maxLines: 1,
                                          overflow: TextOverflow.ellipsis,
                                          style: const TextStyle(
                                            fontWeight: FontWeight.w800,
                                          ),
                                        ),
                                      ),
                                      const SizedBox(width: 8),
                                      Text(
                                        _money(balance),
                                        style: const TextStyle(
                                          fontWeight: FontWeight.w800,
                                        ),
                                      ),
                                    ],
                                  ),
                                  const SizedBox(height: 4),
                                  Wrap(
                                    spacing: 8,
                                    runSpacing: 4,
                                    children: [
                                      // Short code
                                      if (_text(row, ['short_code']).isNotEmpty)
                                        _MiniMeta(
                                            icon: Icons.qr_code_2,
                                            text: _text(row, ['short_code'])),
                                      // Order number (only when different from short_code)
                                      if (() {
                                        final sc = _text(row, ['short_code']);
                                        final on = _text(row,
                                            ['order_number', 'bill_number']);
                                        return on.isNotEmpty && on != sc;
                                      }())
                                        _MiniMeta(
                                            icon: Icons.receipt_outlined,
                                            text: _text(row, [
                                              'order_number',
                                              'bill_number'
                                            ])),
                                      // Table / location
                                      if (_text(row, ['location']).isNotEmpty &&
                                          _text(row, ['location']) != '—')
                                        _MiniMeta(
                                            icon: Icons.table_restaurant,
                                            text: _text(row, ['location'])),
                                      // Waiter
                                      if (_text(row, ['waiter_name'])
                                          .isNotEmpty)
                                        _MiniMeta(
                                          icon: Icons.badge_outlined,
                                          text: 'Waiter: ${_text(row, [
                                                'waiter_name'
                                              ])}',
                                        ),
                                      // Outlet / station
                                      if (_text(row, [
                                        'station_name',
                                        'outlet_name'
                                      ]).isNotEmpty)
                                        _MiniMeta(
                                          icon: Icons.storefront,
                                          text: _text(row,
                                              ['station_name', 'outlet_name']),
                                        ),
                                      // Last printed (exact Kenyan time) — for
                                      // accountability, incl. recalled bills.
                                      if (_text(row, [
                                        'last_bill_printed_at',
                                        'captain_printed_at',
                                        'original_bill_printed_at'
                                      ]).isNotEmpty)
                                        _MiniMeta(
                                          icon: Icons.print_outlined,
                                          text:
                                              'Printed ${_date(row['last_bill_printed_at'] ?? row['captain_printed_at'] ?? row['original_bill_printed_at'])}',
                                        ),
                                      // Customer (only when not redundant with waiter)
                                      if (customer.isNotEmpty &&
                                          customer.toLowerCase() != 'walk-in' &&
                                          customer !=
                                              _text(row, ['waiter_name']))
                                        _MiniMeta(
                                            icon: Icons.person_outline,
                                            text: customer),
                                      // Time
                                      if (_text(
                                              row, ['created_at', 'bill_date'])
                                          .isNotEmpty)
                                        _MiniMeta(
                                          icon: Icons.access_time,
                                          text: () {
                                            final dt = DateTime.tryParse(_text(
                                                row,
                                                ['created_at', 'bill_date']));
                                            if (dt == null) return '';
                                            final local = dt.toLocal();
                                            return '${local.hour.toString().padLeft(2, '0')}:${local.minute.toString().padLeft(2, '0')}';
                                          }(),
                                        ),
                                    ],
                                  ),
                                  const SizedBox(height: 6),
                                  Text(
                                    selected
                                        ? 'Loaded in payment panel'
                                        : 'Tap to auto-lookup and clear',
                                    style: TextStyle(
                                      fontSize: 12,
                                      fontWeight: FontWeight.w700,
                                      color: selected
                                          ? AppColors.kPrimary
                                          : AppColors.kTextSecondary,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                      ),
                    );
                  },
                );
              },
              loading: () => const LoadingSkeleton(type: SkeletonType.list),
              error: (error, _) => ErrorState(message: apiErrorMessage(error)),
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
                _methodChip('room_charge', 'Charge to Room', Icons.bedroom_parent),
              ],
            ),
            const SizedBox(height: 16),
            TextField(
              controller: _amountController,
              keyboardType: TextInputType.number,
              onChanged: (_) => setState(() {}),
              decoration: InputDecoration(
                labelText: 'Amount',
                helperText:
                    _bill == null ? null : 'Balance: ${_money(balance)}',
              ),
            ),
            if (_method == 'cash') ...[
              const SizedBox(height: 12),
              TextField(
                controller: _tenderedController,
                keyboardType: TextInputType.number,
                onChanged: (_) => setState(() {}),
                decoration: const InputDecoration(
                  labelText: 'Cash Given (Tendered)',
                  helperText: 'Amount of cash handed over by the customer',
                  prefixIcon: Icon(Icons.payments, size: 18),
                ),
              ),
              const SizedBox(height: 8),
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                decoration: BoxDecoration(
                  color: (_tendered > 0 && _tendered < _amountDue
                          ? AppColors.kError
                          : _changeDue > 0
                              ? AppColors.kSuccess
                              : AppColors.kTextSecondary)
                      .withValues(alpha: 0.08),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Row(
                  children: [
                    Icon(
                      _tendered > 0 && _tendered < _amountDue
                          ? Icons.warning_amber
                          : Icons.account_balance_wallet,
                      size: 18,
                      color: _tendered > 0 && _tendered < _amountDue
                          ? AppColors.kError
                          : _changeDue > 0
                              ? AppColors.kSuccess
                              : AppColors.kTextSecondary,
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        _tendered <= 0
                            ? 'Enter cash given to compute change'
                            : _tendered < _amountDue
                                ? 'Short by ${_money(_amountDue - _tendered)}'
                                : 'Change to give: ${_money(_changeDue)}',
                        style: TextStyle(
                          fontWeight: FontWeight.w700,
                          color: _tendered > 0 && _tendered < _amountDue
                              ? AppColors.kError
                              : _changeDue > 0
                                  ? AppColors.kSuccess
                                  : AppColors.kTextSecondary,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ],
            if (_method == 'credit_bill') ...[
              const SizedBox(height: 12),
              if (_staffLoading)
                const Padding(
                  padding: EdgeInsets.symmetric(vertical: 8),
                  child: LinearProgressIndicator(),
                )
              else if (_staffOptions.isEmpty)
                const Text(
                  'No branch staff loaded — cannot assign a credit bill.',
                  style: TextStyle(color: AppColors.kError, fontSize: 12),
                )
              else
                _StaffSearchField(
                  staff: _staffOptions,
                  initialId: _selectedStaff?.id,
                  label: 'Assign to staff (search)',
                  onSelected: (s) => setState(() => _selectedStaff = s),
                ),
              if (_selectedStaff != null)
                Padding(
                  padding: const EdgeInsets.only(top: 6),
                  child: Row(children: [
                    const Icon(Icons.check_circle,
                        size: 14, color: AppColors.kSuccess),
                    const SizedBox(width: 6),
                    Expanded(
                      child: Text('Credit assigned to ${_selectedStaff!.name}',
                          style: const TextStyle(
                              fontSize: 12, color: AppColors.kTextSecondary)),
                    ),
                  ]),
                ),
            ],
            const SizedBox(height: 12),
            TextField(
              controller: _referenceController,
              decoration: InputDecoration(
                labelText: _method == 'cash'
                    ? 'Reference (optional)'
                    : _method == 'mpesa_manual'
                        ? 'M-Pesa Reference (required)'
                        : 'Reference',
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
      onSelected: (_) {
        setState(() => _method = value);
        if (value == 'credit_bill') _loadStaff();
      },
    );
  }

  Future<Map<String, dynamic>?> _lookupBill({bool keepAmount = false}) async {
    final id = _lookupController.text.trim();
    if (id.isEmpty) {
      _snack('Enter a bill reference');
      return null;
    }
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
      return data;
    } catch (error) {
      _snack('Bill lookup failed: ${apiErrorMessage(error)}');
      return null;
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _loadUnpaidBill(Map<String, dynamic> row) async {
    final reference = _billLookupReference(row);
    if (reference.isEmpty) return _snack('This bill has no lookup reference');
    setState(() {
      _selectedUnpaidRef = reference;
      _lookupController.text = reference;
      _amountController.clear();
      _referenceController.clear();
      _tenderedController.clear();
      _mpesaMatches = const [];
    });
    final loaded = await _lookupBill();
    if (!mounted || loaded == null) return;
    final balance = _balanceFromBill(loaded);
    // Always refresh the list so the card shows the current balance (not stale
    // data from the last poll cycle).
    ref.invalidate(cashierUnpaidBillsProvider);
    if (balance <= 0) {
      _snack('This bill is already cleared');
    } else {
      _snack('Bill loaded for clearance');
    }
  }

  Future<void> _processPayment() async {
    final bill = _bill;
    if (bill == null) return;
    final amount = num.tryParse(_amountController.text.trim()) ?? 0;
    if (amount <= 0) return _snack('Enter a valid amount');

    if (_method == 'room_charge') {
      _showRoomChargeModal(context, ref, bill, amount);
      return;
    }

    if (_method == 'mpesa_manual' && _referenceController.text.trim().isEmpty) {
      return _snack('Enter the M-Pesa reference code to clear this bill');
    }

    Map<String, dynamic>? creditBill;
    if (_method == 'credit_bill') {
      final staff = _selectedStaff;
      if (staff == null) {
        return _snack('Select the staff member for the credit bill');
      }
      creditBill = {
        'staff_id': staff.id,
        'staff_name': staff.name,
        'employee_id': staff.employeeId,
        'department': staff.department,
        'bill_type': 'cashier_payment',
        'reference_type': 'cashier_payment',
        'reference_id': _billId(bill),
        'total_amount': amount,
        'amount': amount,
        'due_date': _dateOnly(DateTime.now().add(const Duration(days: 30))),
        'payment_method': 'credit_bill',
        'deduction_months': 1,
        'remarks': _referenceController.text.trim().isEmpty
            ? 'Credit bill issued at cashier station'
            : _referenceController.text.trim(),
      };
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
          if (_text(createdCreditData, ['bill_number', 'credit_number'])
              .isNotEmpty)
            'credit_number':
                _text(createdCreditData, ['bill_number', 'credit_number']),
        };
      }
      final isCash = _method == 'cash';
      if (isCash) {
        if (_tendered <= 0) {
          setState(() => _loading = false);
          return _snack('Enter cash given before processing cash payment');
        }
        if (_tendered < amount) {
          setState(() => _loading = false);
          return _snack('Cash given is short by ${_money(amount - _tendered)}');
        }
      }
      final paymentResponse =
          await ref.read(cashierRepositoryProvider).processPayment(
                bookingId: _lookupController.text.trim(),
                amount: amount,
                method: _backendPaymentMethod(_method),
                reference: createdCredit == null
                    ? _referenceController.text.trim()
                    : _text(_payload(createdCredit),
                        ['bill_number', 'credit_number', 'id']),
                creditBill: paymentCreditBill,
                tendered: isCash && _tendered > 0 ? _tendered : null,
                change: isCash ? _changeDue : null,
              );
      final changeGiven = isCash ? _changeDue : 0;
      if (_method == 'credit_bill' && creditBill != null) {
        final staff = _selectedStaff;
        final nav = ref.read(dashboardNavProvider);
        await printCreditBillDocument(
          ref,
          branchName: nav.branchName,
          branchId: nav.user?.branchId,
          staffName: staff?.name ?? _text(creditBill, ['staff_name']),
          employeeId: staff?.employeeId,
          department: staff?.department,
          amount: amount,
          items: _receiptItemsFromBill(bill, amount),
          creditNumber: _text(
              _payload(createdCredit), ['bill_number', 'credit_number', 'id']),
          cashierName: nav.user?.name,
          sourceReference: _text(bill, ['bill_number', 'order_number', 'id']),
        );
        _snack('Credit bill issued for ${staff?.name ?? 'staff'}');
      } else {
        await _printStationReceipt(
          bill: bill,
          amount: amount,
          method: _method,
          response: paymentResponse,
          fallbackReference: createdCredit == null
              ? _referenceController.text.trim()
              : _text(_payload(createdCredit),
                  ['bill_number', 'credit_number', 'id']),
          changeGiven: changeGiven,
          amountTendered: isCash ? _tendered : 0,
        );
        _snack(changeGiven > 0
            ? 'Payment recorded · Give change ${_money(changeGiven)}'
            : 'Payment recorded');
      }
      _tenderedController.clear();
      ref.invalidate(cashierStatsProvider);
      ref.invalidate(cashierUnpaidBillsProvider);
      ref.invalidate(cashierCreditBillsProvider);
      ref.invalidate(cashierShiftsProvider);
      ref.invalidate(cashierCurrentShiftProvider);
      await _lookupBill();
    } catch (error) {
      _snack('Payment failed: ${apiErrorMessage(error)}');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _showRoomChargeModal(
      BuildContext context, WidgetRef ref, Map<String, dynamic> bill, num amount) async {
    final nav = ref.read(dashboardNavProvider);
    final branchId = int.tryParse('${nav.user?.branchId ?? 1}') ?? 1;
    final repository = ref.read(cashierRepositoryProvider);

    final searchCtrl = TextEditingController();
    List<Map<String, dynamic>> eligibleGuests = [];
    bool searching = true;
    Map<String, dynamic>? selectedGuest;

    Future<void> searchGuests(String q, void Function(void Function()) setModalState) async {
      setModalState(() => searching = true);
      try {
        eligibleGuests = await repository.getEligibleRoomChargeGuests(
          branchId: branchId,
          query: q,
        );
        setModalState(() {});
      } catch (e) {
        _snack('Error loading in-house rooms: $e');
      } finally {
        setModalState(() => searching = false);
      }
    }

    try {
      eligibleGuests = await repository.getEligibleRoomChargeGuests(branchId: branchId);
    } catch (e) {
      _snack('Error loading in-house rooms: $e');
    } finally {
      searching = false;
    }

    if (!mounted) return;

    await showDialog<void>(
      context: context,
      builder: (dialogCtx) {
        return StatefulBuilder(
          builder: (context, setModalState) {
            if (selectedGuest != null) {
              final guestName = '${selectedGuest!['guest_name'] ?? 'Guest'}';
              final roomNo = '${selectedGuest!['room_number'] ?? '-'}';
              final bookingRef = '${selectedGuest!['confirmation_number'] ?? '-'}';
              final folioBal = _money(selectedGuest!['folio_balance'] ?? 0);
              final stayNights = _num(selectedGuest!['stay_nights']).round();
              final outletName = _text(bill, ['outlet_name', 'outletName']).isEmpty
                  ? 'Restaurant POS'
                  : _text(bill, ['outlet_name', 'outletName']);
              final billNo = _text(bill, ['bill_number', 'short_code', 'id']).isEmpty
                  ? 'BILL'
                  : _text(bill, ['bill_number', 'short_code', 'id']);

              return AlertDialog(
                title: const Row(
                  children: [
                    Icon(Icons.bedroom_parent, color: AppColors.kPrimary),
                    SizedBox(width: 8),
                    Text('Confirm Room Charge'),
                  ],
                ),
                content: SizedBox(
                  width: 520,
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: Colors.blue.shade50,
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(color: Colors.blue.shade200),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text('GUEST INFORMATION',
                                style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Colors.blue)),
                            const SizedBox(height: 6),
                            Text('Guest Name: $guestName', style: const TextStyle(fontWeight: FontWeight.bold)),
                            Text('Room Number: $roomNo • Ref: $bookingRef'),
                            if (stayNights > 0)
                              Text('Stay Length: $stayNights night${stayNights == 1 ? '' : 's'}'),
                            Text('Current Folio Balance: $folioBal', style: TextStyle(color: Colors.grey.shade700)),
                          ],
                        ),
                      ),
                      const SizedBox(height: 14),
                      Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: Colors.grey.shade50,
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(color: Colors.grey.shade200),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text('BILL INFORMATION',
                                style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Colors.black54)),
                            const SizedBox(height: 6),
                            Text('Outlet: $outletName • Bill #: $billNo'),
                            Text('Amount to Charge: ${_money(amount)}',
                                style: const TextStyle(fontWeight: FontWeight.bold, color: AppColors.kPrimary, fontSize: 16)),
                          ],
                        ),
                      ),
                      const SizedBox(height: 16),
                      Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: Colors.amber.shade50,
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(color: Colors.amber.shade300),
                        ),
                        child: Text(
                          'This bill will be posted to Room $roomNo under $guestName and added to the guest’s final accommodation charges.',
                          style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Colors.amber.shade900),
                        ),
                      ),
                    ],
                  ),
                ),
                actions: [
                  TextButton(
                    onPressed: () => setModalState(() => selectedGuest = null),
                    child: const Text('Back'),
                  ),
                  ElevatedButton.icon(
                    icon: const Icon(Icons.check_circle, size: 16),
                    label: const Text('Confirm Room Charge'),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.kPrimary,
                      foregroundColor: Colors.white,
                    ),
                    onPressed: () async {
                      Navigator.pop(dialogCtx);
                      await _postRoomChargeTransaction(
                        bill: bill,
                        bookingId: selectedGuest!['booking_id'],
                        roomNumber: roomNo,
                        guestName: guestName,
                        amount: amount,
                      );
                    },
                  ),
                ],
              );
            }

            return AlertDialog(
              title: const Row(
                children: [
                  Icon(Icons.bedroom_parent, color: AppColors.kPrimary),
                  SizedBox(width: 8),
                  Text('Charge Bill to Guest Room'),
                ],
              ),
              content: SizedBox(
                width: 520,
                height: 480,
                child: Column(
                  children: [
                    TextField(
                      controller: searchCtrl,
                      decoration: InputDecoration(
                        hintText: 'Search in-house room, guest, booking ref, phone...',
                        prefixIcon: const Icon(Icons.search),
                        suffixIcon: IconButton(
                          icon: const Icon(Icons.arrow_forward),
                          onPressed: () =>
                              searchGuests(searchCtrl.text.trim(), setModalState),
                        ),
                        isDense: true,
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                      ),
                      onSubmitted: (q) => searchGuests(q.trim(), setModalState),
                    ),
                    const SizedBox(height: 12),
                    if (searching)
                      const Padding(
                        padding: EdgeInsets.all(24),
                        child: CircularProgressIndicator(),
                      )
                    else if (eligibleGuests.isEmpty)
                      const Expanded(
                        child: Center(
                          child: Text(
                            'No in-house overnight stays found for room charging.',
                            style: TextStyle(color: Colors.grey),
                          ),
                        ),
                      )
                    else
                      Expanded(
                        child: ListView.separated(
                          itemCount: eligibleGuests.length,
                          separatorBuilder: (_, __) => const Divider(height: 1),
                          itemBuilder: (context, idx) {
                            final g = eligibleGuests[idx];
                            final roomStr = '${g['room_number'] ?? '-'}';
                            final gName = '${g['guest_name'] ?? 'Guest'}';
                            final bRef = '${g['confirmation_number'] ?? '-'}';
                            final bal = _money(g['folio_balance'] ?? 0);
                            final meal = g['meal_plan'] ?? 'Room Only';
                            final stayNights = _num(g['stay_nights']).round();
                            final checkIn = _text(g, ['check_in_date']);
                            final checkOut = _text(g, ['check_out_date']);

                            return ListTile(
                              leading: CircleAvatar(
                                backgroundColor: AppColors.kPrimary.withValues(alpha: 0.1),
                                child: Text(
                                  roomStr,
                                  style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: AppColors.kPrimary),
                                ),
                              ),
                              title: Text(gName, style: const TextStyle(fontWeight: FontWeight.bold)),
                              subtitle: Text(
                                'Ref: $bRef • Meal: $meal • ${stayNights > 0 ? '$stayNights night${stayNights == 1 ? '' : 's'}' : 'In-house'} • $checkIn to $checkOut • Bal: $bal',
                              ),
                              trailing: ElevatedButton(
                                child: const Text('Select'),
                                onPressed: () {
                                  setModalState(() => selectedGuest = g);
                                },
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
                  onPressed: () => Navigator.pop(dialogCtx),
                  child: const Text('Cancel'),
                ),
              ],
            );
          },
        );
      },
    );
  }

  Future<void> _postRoomChargeTransaction({
    required Map<String, dynamic> bill,
    required String bookingId,
    required String roomNumber,
    required String guestName,
    required num amount,
  }) async {
    setState(() => _loading = true);
    try {
      final nav = ref.read(dashboardNavProvider);
      final branchId = int.tryParse('${nav.user?.branchId ?? 1}') ?? 1;
      final outletName = _text(bill, ['outlet_name', 'outletName']).isEmpty
          ? 'Restaurant POS'
          : _text(bill, ['outlet_name', 'outletName']);
      final billNo = _text(bill, ['bill_number', 'short_code', 'id']).isEmpty
          ? 'BILL'
          : _text(bill, ['bill_number', 'short_code', 'id']);
      final response = await ref.read(cashierRepositoryProvider).postRoomCharge({
        'branch_id': branchId,
        'source': _text(bill, ['source', 'source_type', 'bill_type']),
        'source_type': _text(bill, ['source_type', 'bill_type']),
        'bill_type': _text(bill, ['bill_type']),
        'outlet_name': outletName,
        'outlet_type': _text(bill, ['outlet_type', 'source_type']).isEmpty
            ? 'POS'
            : _text(bill, ['outlet_type', 'source_type']),
        'bill_id': _billId(bill),
        'bill_number': billNo,
        'order_number': _text(bill, ['order_number', 'bill_number', 'short_code', 'id']).isEmpty
            ? billNo
            : _text(bill, ['order_number', 'bill_number', 'short_code', 'id']),
        'booking_id': bookingId,
        'room_number': roomNumber,
        'guest_name': guestName,
        'total_amount': amount,
        'items': _billItems(bill),
        'waiter_name': _text(bill, ['waiter_name', 'customer_name']).isEmpty
            ? (nav.user?.name ?? 'Staff')
            : _text(bill, ['waiter_name', 'customer_name']),
      });

      if (response['success'] == true) {
        _snack('Bill $billNo charged to Room $roomNumber ($guestName) successfully!');
        setState(() {
          _bill = null;
          _amountController.clear();
          _referenceController.clear();
        });
        ref.invalidate(cashierUnpaidBillsProvider);
      } else {
        _snack('Failed to charge room: ${response['message']}');
      }
    } catch (e) {
      _snack('Error posting room charge: $e');
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
    final changeGiven = _num(body['change_given']);
    final amountTendered = _num(body['amount_tendered']);
    final auditedPayments =
        _withCashAudit(payments, amountTendered, changeGiven);

    final totalPaid = payments.fold<num>(
      0,
      (sum, payment) => sum + _num(payment['payment_amount']),
    );
    if (totalPaid <= 0) return _snack('Enter a valid payment amount');

    setState(() => _loading = true);
    try {
      final responses = <Map<String, dynamic>>[];
      final receiptRefs = <String>[];

      for (final payment in auditedPayments) {
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
          reference =
              _text(createdCreditData, ['bill_number', 'credit_number', 'id']);
          paymentCreditBill = {
            ...creditBill,
            if (_text(createdCreditData, ['id']).isNotEmpty)
              'id': _text(createdCreditData, ['id']),
            if (_text(createdCreditData, ['staff_credit_bill_id']).isNotEmpty)
              'staff_credit_bill_id':
                  _text(createdCreditData, ['staff_credit_bill_id']),
            if (_text(createdCreditData, ['bill_number', 'credit_number'])
                .isNotEmpty)
              'credit_number':
                  _text(createdCreditData, ['bill_number', 'credit_number']),
          };
        }

        final response =
            await ref.read(cashierRepositoryProvider).processPayment(
                  bookingId: _lookupController.text.trim(),
                  amount: amount,
                  method: method,
                  reference: reference,
                  creditBill: paymentCreditBill,
                  tendered: _num(payment['amount_tendered']) > 0
                      ? _num(payment['amount_tendered'])
                      : null,
                  change: _num(payment['change_given']) > 0
                      ? _num(payment['change_given'])
                      : null,
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
        changeGiven: changeGiven,
        amountTendered: amountTendered,
      );
      _snack(
        changeGiven > 0
            ? 'Payment recorded · Give change ${_money(changeGiven)}'
            : totalPaid >= balance
                ? 'Split payment recorded and bill cleared'
                : 'Partial payment recorded. Remaining: ${_money(balance - totalPaid)}',
      );
      ref.invalidate(cashierStatsProvider);
      ref.invalidate(cashierCurrentShiftProvider);
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
    num changeGiven = 0,
    num amountTendered = 0,
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
      final outletId = _text(bill, ['outlet_id', 'outletId']).isNotEmpty
          ? _text(bill, ['outlet_id', 'outletId'])
          : nav.user?.outletId;
      await printCustomerDocument(
        ref,
        templateKey: 'customer_receipt',
        fallbackTitle: 'CUSTOMER RECEIPT',
        branchId: nav.user?.branchId,
        outletId: outletId,
        sale: SaleResult(
          transactionId:
              reference.isEmpty ? DateTime.now().toString() : reference,
          createdAt: DateTime.now(),
          receiptNumber: reference.isEmpty ? null : reference,
          cashierName: nav.user?.name,
          total: amount.toDouble(),
          paymentMethod: methodLabel,
        ),
        items: receiptItems,
        branchName: nav.branchName,
        customerName: _customerName(bill),
        // The bill's own alphanumeric short_code must win over whatever the
        // cashier typed/scanned to look it up (which may be a plain numeric
        // order/booking id) — otherwise the receipt prints that raw number
        // as the "short code" instead of a proper letter+number code.
        publicCode: _billShortCode(bill).isNotEmpty
            ? _billShortCode(bill)
            : _lookupController.text.trim(),
        amountTendered: amountTendered,
        changeGiven: changeGiven,
      );
    } catch (error) {
      _snack('Payment recorded, but receipt failed: ${apiErrorMessage(error)}'
          ' — trying backend fallback print...');
      await _tryFallbackPrint(
        bill: bill,
        amount: amount,
        method: method,
        response: response,
        fallbackReference: fallbackReference,
      );
    }
  }

  /// Last-resort backend print, only reached when the client-side print in
  /// _printStationReceipt above has already thrown.
  Future<void> _tryFallbackPrint({
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

      final shortCode = _billShortCode(bill);
      await ref.read(cashierRepositoryProvider).printReceiptFallback(
            orderNumber: reference.isEmpty
                ? 'CASH-${DateTime.now().millisecondsSinceEpoch}'
                : reference,
            shortCode: shortCode.isNotEmpty ? shortCode : null,
            customerName: _customerName(bill),
            items: receiptItems
                .map((item) => {
                      'name': item.name,
                      'quantity': item.qty,
                      'unit_price': item.unitPrice,
                      'line_total': item.lineTotal,
                    })
                .toList(),
            amountPaid: amount,
            paymentMethod: method,
            outletName: nav.branchName,
          );
      _snack('Backend fallback receipt printed');
    } catch (fallbackError) {
      _snack(
          'Backend fallback print also failed: ${apiErrorMessage(fallbackError)}');
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
                      decoration: InputDecoration(
                        labelText: _method == 'MPESA_MANUAL'
                            ? 'M-Pesa Reference (required)'
                            : 'Phone/reference',
                      ),
                      onChanged: (_) => setState(() {}),
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
    if (_method == 'MPESA_MANUAL' && _phoneController.text.trim().isEmpty) {
      return _snack('Enter the M-Pesa reference code to clear this sale');
    }
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
          if (_text(createdCreditData, ['bill_number', 'credit_number'])
              .isNotEmpty)
            'credit_number':
                _text(createdCreditData, ['bill_number', 'credit_number']),
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
      final receiptItems = items
          .map(
            (item) => CartItem(
              productId: _text(item, ['product_id', 'id']),
              name: _text(item, ['name', 'item_name']),
              unitPrice: _num(item['unit_price']).toDouble(),
              qty: (_num(item['qty'] ?? item['quantity'])).round(),
            ),
          )
          .toList();
      final outletId = _text(transaction, ['outlet_id', 'outletId']).isNotEmpty
          ? _text(transaction, ['outlet_id', 'outletId'])
          : nav.user?.outletId;
      await printCustomerDocument(
        ref,
        templateKey: 'customer_receipt',
        fallbackTitle: 'CUSTOMER RECEIPT',
        branchId: nav.user?.branchId,
        outletId: outletId,
        sale: SaleResult(
          transactionId: _text(transaction, ['id', 'transaction_id']),
          createdAt: DateTime.now(),
          receiptNumber: reference.isEmpty ? null : reference,
          cashierName: nav.user?.name,
          total: total.toDouble(),
          paymentMethod: methodLabel,
        ),
        items: receiptItems,
        branchName: nav.branchName,
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

  @override
  Widget build(BuildContext context) {
    // Show EVERY still-unpaid bill while a shift is open — no date scoping. A
    // bill stays unpaid until it is settled, so one from yesterday must still
    // appear here. (No `date` filter is sent, so the backend returns all unpaid.)
    final filters = CashierBillFilters(status: _status, search: _search);
    final bills = ref.watch(cashierUnpaidBillsProvider(filters));
    return _BillsScaffold(
      title: 'Unpaid Bills',
      status: _status,
      onStatusChanged: (value) => setState(() => _status = value ?? 'all'),
      onSearch: (value) => setState(() => _search = value),
      // No Create — unpaid bills originate from the POS.
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          bills.when(
            data: (rows) => _BillList(
              rows: rows,
              emptyMessage: 'No unpaid bills',
              onPay: (row) => _recordPayment(row),
            ),
            loading: () => const LoadingSkeleton(type: SkeletonType.list),
            error: (error, _) => ErrorState(message: apiErrorMessage(error)),
          ),
        ],
      ),
    );
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
    final changeGiven = _num(body['change_given']);
    final amountTendered = _num(body['amount_tendered']);
    final auditedPayments =
        _withCashAudit(payments, amountTendered, changeGiven);
    final repo = ref.read(cashierRepositoryProvider);
    try {
      final source = _text(row, ['source']);
      final isWaiter = row['is_waiter_order'] == true &&
          (source == 'restaurant' || source == 'bar' || source == 'pos');
      final responses = <Map<String, dynamic>>[];
      final receiptRefs = <String>[];
      for (final payment in auditedPayments) {
        if (_text(payment, ['payment_method']) == 'credit_bill') {
          // Settle as a staff credit bill. This must CLEAR the source order and
          // record to the active shift — the credit is owed by the SELECTED
          // staff (not the waiter), settled later by the branch accountant.
          final amt = _num(payment['payment_amount']);
          final reference = _receiptReferenceForPayment(payment);
          Map<String, dynamic> created;
          if (isWaiter) {
            // markWaiterOrderPaid creates the staff credit bill (for the
            // selected staff_id), marks the order credit_bill, and records the
            // shift sale in one call.
            created = _payload(
                await repo.clearWaiterOrder(source, _text(row, ['id']), {
              'payment_method': 'credit_bill',
              'payment_amount': amt,
              'payment_reference': reference,
              'staff_id': _text(payment, ['staff_id']),
              'staff_name': _text(payment, ['staff_name']),
            }));
          } else {
            // Manual unpaid bill: create the staff credit bill, then mark the
            // bill settled-by-credit (records the shift sale).
            final credit = _payload(await repo.createCreditBill({
              'staff_id': _text(payment, ['staff_id']),
              'staff_name': _text(payment, ['staff_name']),
              'bill_type': 'cashier_payment',
              'reference_type': 'cashier_payment',
              'reference_id': _billId(row),
              'total_amount': amt,
              'amount': amt,
              'due_date':
                  _dateOnly(DateTime.now().add(const Duration(days: 30))),
              'payment_method': 'credit_bill',
              'deduction_months': 1,
            }));
            final creditId =
                _text(credit, ['staff_credit_bill_id', 'id', 'credit_number']);
            await repo.recordUnpaidBillPayment(_text(row, ['id']), {
              'payment_amount': amt,
              'payment_method': 'credit_bill',
              'payment_reference': reference,
              if (creditId.isNotEmpty) 'credit_bill_id': creditId,
            });
            created = credit;
          }
          responses.add(created);
          receiptRefs.add(reference);
          // Print a dedicated staff credit-bill receipt for this line.
          try {
            // Prefer a short, human/scannable code (order short code) over the
            // raw credit-bill UUID for the printed CREDIT BILL CODE.
            final creditCode = _creditCodeForReceipt(row, created, reference);
            final nav = ref.read(dashboardNavProvider);
            await printCreditBillDocument(
              ref,
              branchName: nav.branchName,
              branchId: nav.user?.branchId,
              staffName: _text(payment, ['staff_name']),
              amount: amt,
              items: _receiptItemsFromBill(row, amt),
              creditNumber: creditCode,
              cashierName: nav.user?.name,
              sourceReference:
                  _text(row, ['bill_number', 'order_number', 'id']),
            );
          } catch (_) {}
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
      // Only print the standard payment receipt if there was a real (non-credit)
      // payment — credit lines already printed their own credit-bill receipt.
      final nonCredit = payments
          .where((p) => _text(p, ['payment_method']) != 'credit_bill')
          .toList();
      if (nonCredit.isNotEmpty) {
        try {
          await _printCashierBillReceipt(
            ref: ref,
            bill: row,
            amount:
                nonCredit.fold<num>(0, (s, p) => s + _num(p['payment_amount'])),
            method: nonCredit.length == 1
                ? _text(nonCredit.first, ['payment_method'])
                : 'split',
            response: responses.isEmpty ? const {} : responses.last,
            fallbackReference: receiptRefs.join(' | '),
            amountTendered: amountTendered,
            changeGiven: changeGiven,
          );
        } catch (error) {
          _snack(
              'Payment recorded, but receipt failed: ${apiErrorMessage(error)}');
        }
      }
      ref.invalidate(cashierUnpaidBillsProvider);
      ref.invalidate(cashierStatsProvider);
      ref.invalidate(cashierCreditBillsProvider);
      ref.invalidate(cashierShiftsProvider);
      ref.invalidate(cashierCurrentShiftProvider);
      final hasCredit =
          payments.any((p) => _text(p, ['payment_method']) == 'credit_bill');
      _snack(changeGiven > 0
          ? 'Payment recorded · Give change ${_money(changeGiven)}'
          : hasCredit
              ? 'Credit bill issued and order cleared'
              : payments.length > 1
                  ? 'Split payment recorded'
                  : 'Payment recorded');
    } catch (error) {
      _snack('Payment failed: ${apiErrorMessage(error)}');
    }
  }

  void _snack(String message) {
    if (!mounted) return;
    AppNotifier.show(context, message);
  }
}

/// Cashier stage 1 of the two-stage item void flow: a waiter has flagged an
/// item to void on a live bill and this cashier (the open shift's assigned
/// cashier_id) must acknowledge or decline before it can reach the
/// manager/accountant for final approval.
class _VoidRequestsTab extends ConsumerStatefulWidget {
  const _VoidRequestsTab();

  @override
  ConsumerState<_VoidRequestsTab> createState() => _VoidRequestsTabState();
}

class _VoidRequestsTabState extends ConsumerState<_VoidRequestsTab> {
  final Set<String> _busyIds = {};
  final Set<String> _busyBillIds = {};

  @override
  Widget build(BuildContext context) {
    final requestsAsync = ref.watch(cashierPendingItemVoidsProvider);
    final billRequestsAsync = ref.watch(cashierPendingWholeBillVoidsProvider);
    final awaitingKitchenItemsAsync =
        ref.watch(cashierAwaitingKitchenItemVoidsProvider);
    final awaitingKitchenBillsAsync =
        ref.watch(cashierAwaitingKitchenWholeBillVoidsProvider);
    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text('Void Requests',
                    style: Theme.of(context).textTheme.titleLarge),
              ),
              OutlinedButton.icon(
                onPressed: () {
                  ref.invalidate(cashierPendingItemVoidsProvider);
                  ref.invalidate(cashierPendingWholeBillVoidsProvider);
                  ref.invalidate(cashierAwaitingKitchenItemVoidsProvider);
                  ref.invalidate(cashierAwaitingKitchenWholeBillVoidsProvider);
                },
                icon: const Icon(Icons.refresh, size: 16),
                label: const Text('Refresh'),
              ),
            ],
          ),
          const SizedBox(height: 6),
          const Text(
            'Kitchen acknowledges a waiter\'s void request first. Once '
            'kitchen has acknowledged, it lands here — acknowledge to apply '
            'the void and send it on to the branch accountant for final '
            'approval, or decline to stop it here and keep the item/bill as-is.',
            style: TextStyle(color: AppColors.kTextSecondary, fontSize: 13),
          ),
          const SizedBox(height: 20),
          Text('Items', style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 8),
          requestsAsync.when(
            data: (rows) => rows.isEmpty
                ? const EmptyState(
                    icon: Icons.check_circle_outline,
                    message: 'No item void requests waiting on you.',
                  )
                : Column(children: [for (final r in rows) _requestCard(r)]),
            loading: () => const LoadingSkeleton(type: SkeletonType.list),
            error: (error, _) => ErrorState(
              message: apiErrorMessage(error),
              onRetry: () => ref.invalidate(cashierPendingItemVoidsProvider),
            ),
          ),
          awaitingKitchenItemsAsync.maybeWhen(
            data: (rows) => rows.isEmpty
                ? const SizedBox.shrink()
                : _awaitingKitchenPanel(
                    'Awaiting kitchen (item)',
                    rows
                        .map((r) =>
                            '${r.itemName} ×${r.qtyToVoid.toStringAsFixed(r.qtyToVoid % 1 == 0 ? 0 : 1)}'
                            '${(r.orderNumber ?? '').isNotEmpty ? ' — Order ${r.orderNumber}' : ''}')
                        .toList(),
                  ),
            orElse: () => const SizedBox.shrink(),
          ),
          const SizedBox(height: 24),
          Text('Whole Bills', style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 8),
          billRequestsAsync.when(
            data: (rows) => rows.isEmpty
                ? const EmptyState(
                    icon: Icons.check_circle_outline,
                    message: 'No bill void requests waiting on you.',
                  )
                : Column(children: [for (final r in rows) _billRequestCard(r)]),
            loading: () => const LoadingSkeleton(type: SkeletonType.list),
            error: (error, _) => ErrorState(
              message: apiErrorMessage(error),
              onRetry: () =>
                  ref.invalidate(cashierPendingWholeBillVoidsProvider),
            ),
          ),
          awaitingKitchenBillsAsync.maybeWhen(
            data: (rows) => rows.isEmpty
                ? const SizedBox.shrink()
                : _awaitingKitchenPanel(
                    'Awaiting kitchen (whole bill)',
                    rows.map((r) => 'Bill ${r['order_number'] ?? ''}').toList(),
                  ),
            orElse: () => const SizedBox.shrink(),
          ),
        ],
      ),
    );
  }

  /// Read-only "FYI" panel — these requests haven't reached the cashier yet
  /// (kitchen hasn't acknowledged), so there's nothing to acknowledge/decline
  /// here. Without this, an empty actionable list above reads as "voiding is
  /// broken" rather than "kitchen hasn't acted yet."
  Widget _awaitingKitchenPanel(String title, List<String> lines) {
    return Padding(
      padding: const EdgeInsets.only(top: 10),
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: AppColors.kTextSecondary.withValues(alpha: 0.08),
          borderRadius: BorderRadius.circular(8),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(title,
                style: const TextStyle(
                    fontWeight: FontWeight.w600,
                    fontSize: 12,
                    color: AppColors.kTextSecondary)),
            const SizedBox(height: 4),
            for (final line in lines)
              Text('⏳ $line',
                  style: const TextStyle(
                      fontSize: 12, color: AppColors.kTextSecondary)),
          ],
        ),
      ),
    );
  }

  Widget _billRequestCard(Map<String, dynamic> r) {
    final id = '${r['id'] ?? ''}';
    final busy = _busyBillIds.contains(id);
    final orderNumber = '${r['order_number'] ?? ''}';
    final totalAmount = double.tryParse('${r['total_amount'] ?? 0}') ?? 0;
    final requestedByName = '${r['requested_by_name'] ?? ''}';
    final kitchenName = '${r['kitchen_name'] ?? ''}';
    final reason = '${r['reason'] ?? ''}';
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    orderNumber.isNotEmpty ? 'Bill $orderNumber' : 'Bill',
                    style: const TextStyle(
                        fontWeight: FontWeight.w700, fontSize: 15),
                  ),
                ),
                Text(_money(totalAmount),
                    style: const TextStyle(
                        fontWeight: FontWeight.w700, fontSize: 15)),
              ],
            ),
            const SizedBox(height: 4),
            Text(
              [
                if (requestedByName.isNotEmpty) 'by $requestedByName',
                if (kitchenName.isNotEmpty) 'kitchen: $kitchenName',
              ].join('  ·  '),
              style: const TextStyle(
                  color: AppColors.kTextSecondary, fontSize: 13),
            ),
            if (reason.isNotEmpty) ...[
              const SizedBox(height: 6),
              Text('Reason: $reason', style: const TextStyle(fontSize: 13)),
            ],
            const SizedBox(height: 12),
            Row(
              mainAxisAlignment: MainAxisAlignment.end,
              children: [
                OutlinedButton.icon(
                  onPressed: busy || id.isEmpty ? null : () => _declineBill(id),
                  icon: const Icon(Icons.close,
                      size: 16, color: AppColors.kError),
                  label: const Text('Decline',
                      style: TextStyle(color: AppColors.kError)),
                ),
                const SizedBox(width: 8),
                ElevatedButton.icon(
                  onPressed:
                      busy || id.isEmpty ? null : () => _acknowledgeBill(id),
                  icon: busy
                      ? const SizedBox(
                          width: 16,
                          height: 16,
                          child: CircularProgressIndicator(strokeWidth: 2))
                      : const Icon(Icons.check, size: 16),
                  label: const Text('Acknowledge & Void'),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _acknowledgeBill(String id) async {
    setState(() => _busyBillIds.add(id));
    try {
      await ref
          .read(outletPosRepositoryProvider)
          .cashierAcknowledgeVoidRequest(id);
      ref.invalidate(cashierPendingWholeBillVoidsProvider);
      _snack('Bill voided — sent to branch accountant for final approval.');
    } catch (error) {
      _snack(apiErrorMessage(error));
    } finally {
      if (mounted) setState(() => _busyBillIds.remove(id));
    }
  }

  Future<void> _declineBill(String id) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Decline bill void request?'),
        content: const Text(
            'The bill will stay active as-is. This cannot be undone.'),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: const Text('Cancel')),
          TextButton(
              onPressed: () => Navigator.pop(context, true),
              child: const Text('Decline')),
        ],
      ),
    );
    if (confirmed != true) return;
    setState(() => _busyBillIds.add(id));
    try {
      await ref.read(outletPosRepositoryProvider).cashierDeclineVoidRequest(id);
      ref.invalidate(cashierPendingWholeBillVoidsProvider);
      _snack('Bill void request declined.');
    } catch (error) {
      _snack(apiErrorMessage(error));
    } finally {
      if (mounted) setState(() => _busyBillIds.remove(id));
    }
  }

  Widget _requestCard(ItemVoidRequest r) {
    final busy = _busyIds.contains(r.id);
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    '${r.itemName}  ×${r.qtyToVoid.toStringAsFixed(r.qtyToVoid % 1 == 0 ? 0 : 1)}',
                    style: const TextStyle(
                        fontWeight: FontWeight.w700, fontSize: 15),
                  ),
                ),
                Text(_money(r.amount),
                    style: const TextStyle(
                        fontWeight: FontWeight.w700, fontSize: 15)),
              ],
            ),
            const SizedBox(height: 4),
            Text(
              [
                if (r.orderNumber != null && r.orderNumber!.isNotEmpty)
                  'Order ${r.orderNumber}',
                if (r.requestedByName != null && r.requestedByName!.isNotEmpty)
                  'by ${r.requestedByName}',
              ].join('  ·  '),
              style: const TextStyle(
                  color: AppColors.kTextSecondary, fontSize: 13),
            ),
            if (r.reason.isNotEmpty) ...[
              const SizedBox(height: 6),
              Text('Reason: ${r.reason}', style: const TextStyle(fontSize: 13)),
            ],
            const SizedBox(height: 12),
            Row(
              mainAxisAlignment: MainAxisAlignment.end,
              children: [
                OutlinedButton.icon(
                  onPressed: busy ? null : () => _decline(r),
                  icon: const Icon(Icons.close,
                      size: 16, color: AppColors.kError),
                  label: const Text('Decline',
                      style: TextStyle(color: AppColors.kError)),
                ),
                const SizedBox(width: 8),
                ElevatedButton.icon(
                  onPressed: busy ? null : () => _acknowledge(r),
                  icon: busy
                      ? const SizedBox(
                          width: 16,
                          height: 16,
                          child: CircularProgressIndicator(strokeWidth: 2))
                      : const Icon(Icons.check, size: 16),
                  label: const Text('Acknowledge'),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _acknowledge(ItemVoidRequest r) async {
    setState(() => _busyIds.add(r.id));
    try {
      await ref.read(outletPosRepositoryProvider).cashierAcknowledgeVoid(r.id);
      ref.invalidate(cashierPendingItemVoidsProvider);
      _snack('Acknowledged — sent to manager for approval.');
    } catch (error) {
      _snack(apiErrorMessage(error));
    } finally {
      if (mounted) setState(() => _busyIds.remove(r.id));
    }
  }

  Future<void> _decline(ItemVoidRequest r) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Decline void request?'),
        content: Text(
            'The item "${r.itemName}" will stay on the bill as-is. This cannot be undone.'),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: const Text('Cancel')),
          TextButton(
              onPressed: () => Navigator.pop(context, true),
              child: const Text('Decline')),
        ],
      ),
    );
    if (confirmed != true) return;
    setState(() => _busyIds.add(r.id));
    try {
      await ref.read(outletPosRepositoryProvider).cashierDeclineVoid(r.id);
      ref.invalidate(cashierPendingItemVoidsProvider);
      _snack('Void request declined.');
    } catch (error) {
      _snack(apiErrorMessage(error));
    } finally {
      if (mounted) setState(() => _busyIds.remove(r.id));
    }
  }

  void _snack(String message) {
    if (!mounted) return;
    AppNotifier.show(context, message);
  }
}

/// Post-payment item exchanges: a single-stage flow where this cashier is
/// the sole approver/rejecter (no manager/accountant step, unlike item
/// voids). Approved refund-direction exchanges still need a second action
/// here -- handing back cash from the drawer -- so this tab also surfaces
/// approved-but-unrefunded rows in a separate section.
class _ExchangeRequestsTab extends ConsumerStatefulWidget {
  const _ExchangeRequestsTab();

  @override
  ConsumerState<_ExchangeRequestsTab> createState() =>
      _ExchangeRequestsTabState();
}

class _ExchangeRequestsTabState extends ConsumerState<_ExchangeRequestsTab> {
  final Set<String> _busyIds = {};

  @override
  Widget build(BuildContext context) {
    final pendingAsync = ref.watch(cashierPendingExchangesProvider);
    final awaitingRefundAsync =
        ref.watch(cashierAwaitingRefundExchangesProvider);
    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text('Exchange Requests',
                    style: Theme.of(context).textTheme.titleLarge),
              ),
              OutlinedButton.icon(
                onPressed: () {
                  ref.invalidate(cashierPendingExchangesProvider);
                  ref.invalidate(cashierAwaitingRefundExchangesProvider);
                },
                icon: const Icon(Icons.refresh, size: 16),
                label: const Text('Refresh'),
              ),
            ],
          ),
          const SizedBox(height: 6),
          const Text(
            'Waiters submit these when a customer wants to swap an item on '
            'a bill that is already paid and closed. Approving notifies the '
            'kitchen of the new item and adjusts stock; rejecting leaves the '
            'original bill untouched.',
            style: TextStyle(color: AppColors.kTextSecondary, fontSize: 13),
          ),
          const SizedBox(height: 20),
          pendingAsync.when(
            data: (rows) => rows.isEmpty
                ? const EmptyState(
                    icon: Icons.check_circle_outline,
                    message: 'No exchange requests waiting on you.',
                  )
                : Column(children: [for (final r in rows) _pendingCard(r)]),
            loading: () => const LoadingSkeleton(type: SkeletonType.list),
            error: (error, _) => ErrorState(
              message: apiErrorMessage(error),
              onRetry: () => ref.invalidate(cashierPendingExchangesProvider),
            ),
          ),
          const SizedBox(height: 28),
          Text('Awaiting Refund',
              style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 6),
          const Text(
            'Approved exchanges where the new item was cheaper -- issue the '
            'cash difference from the drawer, then mark it refunded.',
            style: TextStyle(color: AppColors.kTextSecondary, fontSize: 13),
          ),
          const SizedBox(height: 12),
          awaitingRefundAsync.when(
            data: (rows) => rows.isEmpty
                ? const EmptyState(
                    icon: Icons.check_circle_outline,
                    message: 'No refunds waiting to be issued.',
                  )
                : Column(children: [for (final r in rows) _refundCard(r)]),
            loading: () => const LoadingSkeleton(type: SkeletonType.list),
            error: (error, _) => ErrorState(
              message: apiErrorMessage(error),
              onRetry: () =>
                  ref.invalidate(cashierAwaitingRefundExchangesProvider),
            ),
          ),
        ],
      ),
    );
  }

  String _itemsSummary(List<dynamic> items) {
    return items
        .whereType<Map>()
        .map((item) {
          final name = '${item['name'] ?? ''}';
          final qty = item['quantity'];
          final qtyNum = qty is num ? qty : num.tryParse('$qty') ?? 0;
          final qtyLabel = qtyNum % 1 == 0
              ? qtyNum.toStringAsFixed(0)
              : qtyNum.toStringAsFixed(1);
          return '$name ×$qtyLabel';
        })
        .where((label) => label.trim().isNotEmpty && label != ' ×0')
        .join(', ');
  }

  Widget _directionLabel(ItemExchangeRequest r) {
    if (r.isTopUp) {
      return Text('Top-up due: ${_money(r.priceDifference.abs())}',
          style: const TextStyle(
              color: AppColors.kWarning, fontWeight: FontWeight.w700));
    }
    if (r.isRefund) {
      return Text('Refund due: ${_money(r.priceDifference.abs())}',
          style: const TextStyle(
              color: AppColors.kError, fontWeight: FontWeight.w700));
    }
    return const Text('Even exchange -- no money movement',
        style: TextStyle(
            color: AppColors.kTextSecondary, fontWeight: FontWeight.w600));
  }

  Widget _pendingCard(ItemExchangeRequest r) {
    final busy = _busyIds.contains(r.id);
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    r.orderNumber != null && r.orderNumber!.isNotEmpty
                        ? 'Order ${r.orderNumber}'
                        : 'Exchange request',
                    style: const TextStyle(
                        fontWeight: FontWeight.w700, fontSize: 15),
                  ),
                ),
                if (r.requestedByName != null && r.requestedByName!.isNotEmpty)
                  Text('by ${r.requestedByName}',
                      style: const TextStyle(
                          color: AppColors.kTextSecondary, fontSize: 13)),
              ],
            ),
            const SizedBox(height: 8),
            Text('Returning: ${_itemsSummary(r.oldItems)}',
                style: const TextStyle(fontSize: 13)),
            const SizedBox(height: 2),
            Text('Replacing with: ${_itemsSummary(r.newItems)}',
                style: const TextStyle(fontSize: 13)),
            const SizedBox(height: 8),
            _directionLabel(r),
            if (r.reason != null && r.reason!.isNotEmpty) ...[
              const SizedBox(height: 6),
              Text('Reason: ${r.reason}', style: const TextStyle(fontSize: 13)),
            ],
            const SizedBox(height: 12),
            Row(
              mainAxisAlignment: MainAxisAlignment.end,
              children: [
                OutlinedButton.icon(
                  onPressed: busy ? null : () => _reject(r),
                  icon: const Icon(Icons.close,
                      size: 16, color: AppColors.kError),
                  label: const Text('Reject',
                      style: TextStyle(color: AppColors.kError)),
                ),
                const SizedBox(width: 8),
                ElevatedButton.icon(
                  onPressed: busy ? null : () => _approve(r),
                  icon: busy
                      ? const SizedBox(
                          width: 16,
                          height: 16,
                          child: CircularProgressIndicator(strokeWidth: 2))
                      : const Icon(Icons.check, size: 16),
                  label: const Text('Approve'),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _refundCard(ItemExchangeRequest r) {
    final busy = _busyIds.contains(r.id);
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    r.orderNumber != null && r.orderNumber!.isNotEmpty
                        ? 'Order ${r.orderNumber}'
                        : 'Exchange request',
                    style: const TextStyle(
                        fontWeight: FontWeight.w700, fontSize: 15),
                  ),
                ),
                Text(_money((r.refundAmount ?? r.priceDifference).abs()),
                    style: const TextStyle(
                        fontWeight: FontWeight.w700,
                        fontSize: 15,
                        color: AppColors.kError)),
              ],
            ),
            const SizedBox(height: 8),
            Text('Returned: ${_itemsSummary(r.oldItems)}',
                style: const TextStyle(fontSize: 13)),
            const SizedBox(height: 2),
            Text('Replaced with: ${_itemsSummary(r.newItems)}',
                style: const TextStyle(fontSize: 13)),
            const SizedBox(height: 12),
            Row(
              mainAxisAlignment: MainAxisAlignment.end,
              children: [
                ElevatedButton.icon(
                  onPressed: busy ? null : () => _issueRefund(r),
                  icon: busy
                      ? const SizedBox(
                          width: 16,
                          height: 16,
                          child: CircularProgressIndicator(strokeWidth: 2))
                      : const Icon(Icons.payments_outlined, size: 16),
                  label: const Text('Issue Refund'),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _approve(ItemExchangeRequest r) async {
    setState(() => _busyIds.add(r.id));
    try {
      await ref.read(outletPosRepositoryProvider).approveItemExchange(r.id);
      ref.invalidate(cashierPendingExchangesProvider);
      ref.invalidate(cashierAwaitingRefundExchangesProvider);
      _snack('Exchange approved.');
    } catch (error) {
      _snack(apiErrorMessage(error));
    } finally {
      if (mounted) setState(() => _busyIds.remove(r.id));
    }
  }

  Future<void> _reject(ItemExchangeRequest r) async {
    final reasonController = TextEditingController();
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Reject exchange request?'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
                'The original bill stays exactly as-is. This cannot be undone.'),
            const SizedBox(height: 12),
            TextField(
              controller: reasonController,
              decoration: const InputDecoration(
                labelText: 'Reason (optional)',
                isDense: true,
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: const Text('Cancel')),
          TextButton(
              onPressed: () => Navigator.pop(context, true),
              child: const Text('Reject')),
        ],
      ),
    );
    if (confirmed != true) return;
    setState(() => _busyIds.add(r.id));
    try {
      await ref.read(outletPosRepositoryProvider).rejectItemExchange(
            r.id,
            rejectionReason: reasonController.text.trim().isEmpty
                ? null
                : reasonController.text.trim(),
          );
      ref.invalidate(cashierPendingExchangesProvider);
      _snack('Exchange request rejected.');
    } catch (error) {
      _snack(apiErrorMessage(error));
    } finally {
      if (mounted) setState(() => _busyIds.remove(r.id));
    }
  }

  Future<void> _issueRefund(ItemExchangeRequest r) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Issue cash refund?'),
        content: Text(
            'Confirm you have handed back ${_money((r.refundAmount ?? r.priceDifference).abs())} '
            'in cash from the drawer for this exchange.'),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: const Text('Cancel')),
          TextButton(
              onPressed: () => Navigator.pop(context, true),
              child: const Text('Confirm Refund')),
        ],
      ),
    );
    if (confirmed != true) return;
    setState(() => _busyIds.add(r.id));
    try {
      await ref.read(outletPosRepositoryProvider).issueExchangeRefund(r.id);
      ref.invalidate(cashierAwaitingRefundExchangesProvider);
      _snack('Refund recorded.');
    } catch (error) {
      _snack(apiErrorMessage(error));
    } finally {
      if (mounted) setState(() => _busyIds.remove(r.id));
    }
  }

  void _snack(String message) {
    if (!mounted) return;
    AppNotifier.show(context, message);
  }
}

// Cashier Void Management — the cashier searches any unpaid/partial bill in
// the branch (by server name, shortcode, or order number) and voids it
// immediately, whole bill or specific items. This is now the sole entry
// point for voids; bartenders/waiters no longer have a "request void" button
// (see outlet_pos_screen.dart).
class _VoidManagementTab extends ConsumerStatefulWidget {
  const _VoidManagementTab();

  @override
  ConsumerState<_VoidManagementTab> createState() => _VoidManagementTabState();
}

class _VoidManagementTabState extends ConsumerState<_VoidManagementTab> {
  final _searchController = TextEditingController();
  List<Map<String, dynamic>> _results = [];
  bool _searching = false;
  String? _error;

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _search(String query) async {
    if (query.trim().isEmpty) {
      setState(() {
        _results = [];
        _error = null;
      });
      return;
    }
    setState(() {
      _searching = true;
      _error = null;
    });
    try {
      final rows = await ref
          .read(outletPosRepositoryProvider)
          .searchVoidableBills(query);
      if (!mounted) return;
      setState(() {
        _results = rows;
        _searching = false;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _error = apiErrorMessage(error);
        _searching = false;
      });
    }
  }

  Future<void> _openBillActions(Map<String, dynamic> bill) async {
    final action = await showModalBottomSheet<String>(
      context: context,
      builder: (context) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              leading: const Icon(Icons.block, color: Colors.red),
              title: const Text('Void Entire Bill'),
              onTap: () => Navigator.pop(context, 'whole'),
            ),
            ListTile(
              leading: const Icon(Icons.remove_circle_outline),
              title: const Text('Void Specific Item(s)'),
              onTap: () => Navigator.pop(context, 'items'),
            ),
          ],
        ),
      ),
    );
    if (!mounted) return;
    if (action == 'whole') {
      await _voidWholeBillFlow(bill);
    } else if (action == 'items') {
      await _voidItemsFlow(bill);
    }
  }

  String _billLabel(Map<String, dynamic> bill) =>
      '${bill['short_code'] ?? bill['order_number'] ?? 'Bill'}';

  Future<void> _voidWholeBillFlow(Map<String, dynamic> bill) async {
    final total = (bill['total_amount'] as num?)?.toDouble() ?? 0;
    final reasonResult = await showDialog<Map<String, String>>(
      context: context,
      builder: (context) => _VoidReasonDialog(
        title: 'Void Entire Bill',
        subtitle: '${_billLabel(bill)} • KES ${total.toStringAsFixed(2)}',
        confirmLabel: 'CONTINUE',
      ),
    );
    if (reasonResult == null || !mounted) return;

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Confirm void'),
        content: Text(
            'Void the entire bill ${_billLabel(bill)} for KES ${total.toStringAsFixed(2)}? This cannot be undone.'),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: const Text('Cancel')),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            style: FilledButton.styleFrom(backgroundColor: Colors.red),
            child: const Text('VOID BILL'),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;

    try {
      await ref.read(outletPosRepositoryProvider).cashierVoidWholeBill(
            orderId: bill['id'] as String,
            reasonCategory: reasonResult['reasonCategory']!,
            note: reasonResult['note'],
          );
      if (!mounted) return;
      AppNotifier.showSnackBar(
        context,
        const SnackBar(
            content: Text('Bill voided'), backgroundColor: Colors.green),
      );
      setState(() => _results.removeWhere((r) => r['id'] == bill['id']));
    } catch (error) {
      if (!mounted) return;
      AppNotifier.showSnackBar(
        context,
        SnackBar(
            content: Text('Could not void bill: ${apiErrorMessage(error)}')),
      );
    }
  }

  Future<void> _voidItemsFlow(Map<String, dynamic> bill) async {
    final rawItems = (bill['items'] as List?) ?? const [];
    final items =
        rawItems.map((item) => Map<String, dynamic>.from(item as Map)).toList();

    final selected = await showModalBottomSheet<List<Map<String, dynamic>>>(
      context: context,
      isScrollControlled: true,
      builder: (context) => _VoidItemsPickerSheet(items: items),
    );
    if (selected == null || selected.isEmpty || !mounted) return;

    final reasonResult = await showDialog<Map<String, String>>(
      context: context,
      builder: (context) => _VoidReasonDialog(
        title: 'Void ${selected.length} Item(s)',
        subtitle: _billLabel(bill),
        confirmLabel: 'VOID ITEM(S)',
      ),
    );
    if (reasonResult == null || !mounted) return;

    try {
      await ref.read(outletPosRepositoryProvider).cashierVoidLineItems(
            orderId: bill['id'] as String,
            items: selected,
            reasonCategory: reasonResult['reasonCategory']!,
            note: reasonResult['note'],
          );
      if (!mounted) return;
      AppNotifier.showSnackBar(
        context,
        const SnackBar(
            content: Text('Item(s) voided'), backgroundColor: Colors.green),
      );
      await _search(_searchController.text);
    } catch (error) {
      if (!mounted) return;
      AppNotifier.showSnackBar(
        context,
        SnackBar(
            content: Text('Could not void item(s): ${apiErrorMessage(error)}')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Void Management',
              style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: 4),
          const Text(
            'Search by server name, bill shortcode, or order number to void a bill or specific items. Only your branch\'s unpaid/partial bills are searchable.',
            style: TextStyle(color: AppColors.kTextSecondary),
          ),
          const SizedBox(height: 16),
          TextField(
            controller: _searchController,
            decoration: InputDecoration(
              hintText: 'Search server name, shortcode, or order number…',
              prefixIcon: const Icon(Icons.search),
              border: const OutlineInputBorder(),
              suffixIcon: _searching
                  ? const Padding(
                      padding: EdgeInsets.all(12),
                      child: SizedBox(
                          width: 16,
                          height: 16,
                          child: CircularProgressIndicator(strokeWidth: 2)),
                    )
                  : null,
            ),
            textInputAction: TextInputAction.search,
            onSubmitted: _search,
            onChanged: (value) {
              if (value.trim().isEmpty) setState(() => _results = []);
            },
          ),
          const SizedBox(height: 12),
          if (_error != null) ErrorState(message: _error!),
          Expanded(
            child: _results.isEmpty
                ? Center(
                    child: Text(
                      _searching ? 'Searching…' : 'Search for a bill to void',
                      style: const TextStyle(color: AppColors.kTextSecondary),
                    ),
                  )
                : ListView.separated(
                    itemCount: _results.length,
                    separatorBuilder: (_, __) => const Divider(height: 1),
                    itemBuilder: (context, index) {
                      final bill = _results[index];
                      final total =
                          (bill['total_amount'] as num?)?.toDouble() ?? 0;
                      return ListTile(
                        title: Text(_billLabel(bill)),
                        subtitle: Text(
                            '${bill['outlet_name'] ?? ''} • ${bill['waiter_name'] ?? 'Unknown server'} • ${bill['table_number'] ?? bill['room_number'] ?? ''}'),
                        trailing: Text('KES ${total.toStringAsFixed(2)}'),
                        onTap: () => _openBillActions(bill),
                      );
                    },
                  ),
          ),
        ],
      ),
    );
  }
}

class _VoidReasonDialog extends StatefulWidget {
  const _VoidReasonDialog({
    required this.title,
    required this.confirmLabel,
    this.subtitle,
  });

  final String title;
  final String confirmLabel;
  final String? subtitle;

  @override
  State<_VoidReasonDialog> createState() => _VoidReasonDialogState();
}

class _VoidReasonDialogState extends State<_VoidReasonDialog> {
  String _category = cashierVoidReasonCategories.keys.first;
  final _noteController = TextEditingController();

  @override
  void dispose() {
    _noteController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final requiresNote = _category == 'other';
    return AlertDialog(
      title: Text(widget.title),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (widget.subtitle != null) ...[
            Text(widget.subtitle!,
                style: Theme.of(context).textTheme.bodyMedium),
            const SizedBox(height: 12),
          ],
          DropdownButtonFormField<String>(
            initialValue: _category,
            decoration: const InputDecoration(
                labelText: 'Reason', border: OutlineInputBorder()),
            items: cashierVoidReasonCategories.entries
                .map((entry) => DropdownMenuItem(
                    value: entry.key, child: Text(entry.value)))
                .toList(),
            onChanged: (value) {
              if (value != null) setState(() => _category = value);
            },
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _noteController,
            decoration: InputDecoration(
              labelText: requiresNote ? 'Note (required)' : 'Note (optional)',
              border: const OutlineInputBorder(),
            ),
            maxLines: 2,
            onChanged: (_) => setState(() {}),
          ),
        ],
      ),
      actions: [
        TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancel')),
        FilledButton(
          onPressed: (requiresNote && _noteController.text.trim().isEmpty)
              ? null
              : () => Navigator.pop(context, {
                    'reasonCategory': _category,
                    'note': _noteController.text.trim(),
                  }),
          child: Text(widget.confirmLabel),
        ),
      ],
    );
  }
}

class _VoidItemsPickerSheet extends StatefulWidget {
  const _VoidItemsPickerSheet({required this.items});

  final List<Map<String, dynamic>> items;

  @override
  State<_VoidItemsPickerSheet> createState() => _VoidItemsPickerSheetState();
}

class _VoidItemsPickerSheetState extends State<_VoidItemsPickerSheet> {
  final Set<int> _selected = {};
  // Defaults to 1 (not the full active qty) when an item is checked — a 2x
  // line item must let the cashier void just 1 of the 2, not force the whole
  // line out.
  final Map<int, double> _qtyToVoid = {};

  double _activeQty(Map<String, dynamic> item) {
    final qty = (item['quantity'] is num)
        ? (item['quantity'] as num).toDouble()
        : double.tryParse('${item['quantity']}') ?? 0;
    final voided = (item['voided_qty'] is num)
        ? (item['voided_qty'] as num).toDouble()
        : double.tryParse('${item['voided_qty']}') ?? 0;
    return qty - voided;
  }

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Select item(s) to void',
                style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: 4),
            const Text(
              'Adjust quantity per item — voiding a 2x line does not have to void both.',
              style: TextStyle(color: AppColors.kTextSecondary, fontSize: 12),
            ),
            const SizedBox(height: 12),
            ConstrainedBox(
              constraints: BoxConstraints(
                  maxHeight: MediaQuery.of(context).size.height * 0.55),
              child: ListView.builder(
                shrinkWrap: true,
                itemCount: widget.items.length,
                itemBuilder: (context, index) {
                  final item = widget.items[index];
                  final activeQty = _activeQty(item);
                  if (activeQty <= 0) return const SizedBox.shrink();
                  final unitPrice = (item['unit_price'] is num)
                      ? (item['unit_price'] as num).toDouble()
                      : double.tryParse('${item['unit_price']}') ?? 0;
                  final isSelected = _selected.contains(index);
                  final qty = _qtyToVoid[index] ?? 1;
                  return Column(
                    children: [
                      CheckboxListTile(
                        value: isSelected,
                        onChanged: (checked) => setState(() {
                          if (checked == true) {
                            _selected.add(index);
                            _qtyToVoid[index] = activeQty >= 1 ? 1 : activeQty;
                          } else {
                            _selected.remove(index);
                            _qtyToVoid.remove(index);
                          }
                        }),
                        title: Text('${item['name'] ?? 'Item'}'),
                        subtitle: Text(
                            'Active qty ${activeQty.toStringAsFixed(activeQty.truncateToDouble() == activeQty ? 0 : 1)} × KES ${unitPrice.toStringAsFixed(2)}'),
                      ),
                      if (isSelected)
                        Padding(
                          padding: const EdgeInsets.only(
                              left: 56, right: 16, bottom: 8),
                          child: Row(
                            children: [
                              const Text('Qty to void:'),
                              const SizedBox(width: 12),
                              IconButton(
                                icon: const Icon(Icons.remove_circle_outline),
                                onPressed: qty > 1
                                    ? () => setState(
                                        () => _qtyToVoid[index] = qty - 1)
                                    : null,
                              ),
                              Text(
                                qty.toStringAsFixed(
                                    qty.truncateToDouble() == qty ? 0 : 1),
                                style: const TextStyle(
                                    fontWeight: FontWeight.w700),
                              ),
                              IconButton(
                                icon: const Icon(Icons.add_circle_outline),
                                onPressed: qty < activeQty
                                    ? () => setState(
                                        () => _qtyToVoid[index] = qty + 1)
                                    : null,
                              ),
                              const Spacer(),
                              Text(
                                  '= KES ${(qty * unitPrice).toStringAsFixed(2)}'),
                            ],
                          ),
                        ),
                    ],
                  );
                },
              ),
            ),
            const SizedBox(height: 12),
            SizedBox(
              width: double.infinity,
              child: FilledButton(
                onPressed: _selected.isEmpty
                    ? null
                    : () => Navigator.pop(
                          context,
                          _selected.map((index) {
                            return {
                              'item_index': index,
                              'qty_to_void': _qtyToVoid[index] ?? 1,
                            };
                          }).toList(),
                        ),
                child: Text('Continue with ${_selected.length} item(s)'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _VoidedOrdersTab extends ConsumerStatefulWidget {
  const _VoidedOrdersTab();

  @override
  ConsumerState<_VoidedOrdersTab> createState() => _VoidedOrdersTabState();
}

class _VoidedOrdersTabState extends ConsumerState<_VoidedOrdersTab> {
  String _search = '';

  @override
  Widget build(BuildContext context) {
    final filters = CashierBillFilters(status: 'voided', search: _search);
    final orders = ref.watch(cashierVoidedOrdersProvider(filters));
    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Column(
        children: [
          Row(
            children: [
              Expanded(
                child: Text('Voided Orders',
                    style: Theme.of(context).textTheme.titleLarge),
              ),
              SizedBox(
                width: 260,
                child: TextField(
                  onChanged: (value) => setState(() => _search = value),
                  decoration: const InputDecoration(
                    isDense: true,
                    prefixIcon: Icon(Icons.search, size: 18),
                    labelText: 'Search voided orders',
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          orders.when(
            data: (rows) => _BillList(
              rows: rows,
              emptyMessage: 'No voided captain orders',
              onPrint: _printVoidedOrder,
            ),
            loading: () => const LoadingSkeleton(type: SkeletonType.list),
            error: (error, _) => ErrorState(message: apiErrorMessage(error)),
          ),
        ],
      ),
    );
  }

  Future<void> _printVoidedOrder(Map<String, dynamic> row) async {
    try {
      final nav = ref.read(dashboardNavProvider);
      await printVoidOrderDocument(
        ref,
        branchName: nav.branchName,
        branchId: nav.user?.branchId,
        orderNumber: _text(row, ['order_number', 'bill_number', 'id']),
        publicCode: _text(row, ['short_code']),
        customerName: _customerName(row),
        stationName: _text(row, ['station_name', 'outlet_name', 'location']),
        waiterName: _text(row, ['waiter_name']),
        voidReason: _text(row, ['void_reason']),
        voidedAt: DateTime.tryParse('${row['voided_at'] ?? ''}'),
        printedBy: nav.user?.name,
        items: _receiptItemsFromBill(row, _num(row['total_amount'])),
        total: _num(row['total_amount']),
      );
    } catch (error) {
      _snack('Void order print failed: ${apiErrorMessage(error)}');
    }
  }

  void _snack(String message) {
    if (!mounted) return;
    AppNotifier.show(context, message);
  }
}

class _PaidBillsTab extends ConsumerStatefulWidget {
  const _PaidBillsTab();

  @override
  ConsumerState<_PaidBillsTab> createState() => _PaidBillsTabState();
}

class _PaidBillsTabState extends ConsumerState<_PaidBillsTab> {
  final _amountController = TextEditingController();
  final _referenceController = TextEditingController();
  List<_ShiftStaffMember> _staffOptions = const [];
  _ShiftStaffMember? _selectedStaff;
  bool _staffLoading = false;
  String _method = 'cash';
  bool _submitting = false;

  static const _methods = [
    ('cash', 'Cash'),
    ('mpesa', 'M-Pesa'),
    ('card', 'Card'),
  ];

  @override
  void initState() {
    super.initState();
    _loadStaff();
  }

  @override
  void dispose() {
    _amountController.dispose();
    _referenceController.dispose();
    super.dispose();
  }

  Future<void> _loadStaff() async {
    if (_staffOptions.isNotEmpty || _staffLoading) return;
    setState(() => _staffLoading = true);
    try {
      final staff = await ref.read(cashierRepositoryProvider).getBranchStaff();
      if (!mounted) return;
      setState(() {
        _staffOptions = _shiftStaffMembers(staff);
        _staffLoading = false;
      });
    } catch (_) {
      if (mounted) setState(() => _staffLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final paidAsync = ref.watch(cashierPaidBillsProvider);
    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Paid Credits', style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: 6),
          const Text(
            'Record money a staff member pays toward their credit (cash, M-Pesa '
            'or card). Each amount adds to that method’s sales and the Total Paid '
            'Credits, and flows to the branch accountant at shift close to reduce '
            'the staff member’s outstanding credit bill.',
            style: TextStyle(color: AppColors.kTextSecondary, fontSize: 13),
          ),
          const SizedBox(height: 20),
          _recordCard(),
          const SizedBox(height: 24),
          paidAsync.when(
            loading: () => const Padding(
              padding: EdgeInsets.all(32),
              child: Center(child: CircularProgressIndicator()),
            ),
            error: (error, _) => ErrorState(
              message: apiErrorMessage(error),
              onRetry: () => ref.invalidate(cashierPaidBillsProvider),
            ),
            data: (payload) => _paidBillsView(payload),
          ),
        ],
      ),
    );
  }

  Widget _recordCard() {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Record a paid credit',
                style: TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
            const SizedBox(height: 16),
            if (_staffLoading)
              const Padding(
                padding: EdgeInsets.symmetric(vertical: 8),
                child: Row(children: [
                  SizedBox(
                      width: 16,
                      height: 16,
                      child: CircularProgressIndicator(strokeWidth: 2)),
                  SizedBox(width: 10),
                  Text('Loading branch staff…'),
                ]),
              )
            else if (_staffOptions.isEmpty)
              const Text(
                  'No branch staff loaded — cannot record a paid credit.',
                  style: TextStyle(color: AppColors.kTextSecondary))
            else
              _StaffSearchField(
                staff: _staffOptions,
                initialId: _selectedStaff?.id,
                label: 'Staff who paid (search name)',
                onSelected: (s) => setState(() => _selectedStaff = s),
              ),
            const SizedBox(height: 16),
            Wrap(
              spacing: 12,
              runSpacing: 12,
              crossAxisAlignment: WrapCrossAlignment.center,
              children: [
                SizedBox(
                  width: 200,
                  child: TextField(
                    controller: _amountController,
                    keyboardType:
                        const TextInputType.numberWithOptions(decimal: true),
                    decoration: const InputDecoration(
                      labelText: 'Amount paid',
                      prefixText: 'KES ',
                      isDense: true,
                      border: OutlineInputBorder(),
                    ),
                  ),
                ),
                SizedBox(
                  width: 240,
                  child: TextField(
                    controller: _referenceController,
                    decoration: const InputDecoration(
                      labelText: 'Reference (M-Pesa code / receipt)',
                      isDense: true,
                      border: OutlineInputBorder(),
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),
            Row(
              children: [
                const Text('Method:',
                    style:
                        TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
                const SizedBox(width: 12),
                for (final m in _methods)
                  Padding(
                    padding: const EdgeInsets.only(right: 8),
                    child: ChoiceChip(
                      label: Text(m.$2),
                      selected: _method == m.$1,
                      onSelected: (_) => setState(() => _method = m.$1),
                    ),
                  ),
                const Spacer(),
                ElevatedButton.icon(
                  onPressed: _submitting ? null : _record,
                  icon: _submitting
                      ? const SizedBox(
                          width: 16,
                          height: 16,
                          child: CircularProgressIndicator(strokeWidth: 2))
                      : const Icon(Icons.add, size: 18),
                  label: const Text('Record Paid Credit'),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _paidBillsView(Map<String, dynamic> payload) {
    final hasOpenShift = payload['has_open_shift'] != false;
    final rows = (payload['data'] as List?)?.cast<Map<String, dynamic>>() ??
        const <Map<String, dynamic>>[];
    final totals =
        (payload['totals'] as Map?)?.cast<String, dynamic>() ?? const {};
    if (!hasOpenShift) {
      return const EmptyState(
        icon: Icons.lock_clock,
        message: 'Open a shift to start recording paid credits.',
      );
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Wrap(
          spacing: 12,
          runSpacing: 12,
          children: [
            _totalChip('Cash', _num(totals['cash'])),
            _totalChip('M-Pesa', _num(totals['mpesa'])),
            _totalChip('Card', _num(totals['card'])),
            _totalChip('Total Paid Credits', _num(totals['total']),
                strong: true),
          ],
        ),
        const SizedBox(height: 20),
        Text('Recorded this shift (${rows.length})',
            style: Theme.of(context).textTheme.titleMedium),
        const SizedBox(height: 12),
        if (rows.isEmpty)
          const EmptyState(
            icon: Icons.receipt_long,
            message: 'No paid credits recorded yet this shift.',
          )
        else
          for (final row in rows.reversed) _paidRow(row),
      ],
    );
  }

  Widget _totalChip(String label, num value, {bool strong = false}) {
    return Container(
      width: 200,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(
        color:
            strong ? AppColors.kPrimary.withValues(alpha: 0.08) : Colors.white,
        border:
            Border.all(color: strong ? AppColors.kPrimary : AppColors.kDivider),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label,
              style: const TextStyle(
                  color: AppColors.kTextSecondary, fontSize: 12)),
          const SizedBox(height: 4),
          Text(_money(value),
              style: TextStyle(
                  fontWeight: FontWeight.w700,
                  fontSize: strong ? 18 : 16,
                  color: strong ? AppColors.kPrimary : null)),
        ],
      ),
    );
  }

  Widget _paidRow(Map<String, dynamic> row) {
    final name = _text(row, ['name', 'staff_name']);
    final method = _text(row, ['payment_method']).toUpperCase();
    final reference = _text(row, ['reference']);
    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: ListTile(
        leading: const CircleAvatar(child: Icon(Icons.payments, size: 18)),
        title: Text(name.isEmpty ? 'Staff' : name,
            style: const TextStyle(fontWeight: FontWeight.w600)),
        subtitle: Text([
          if (method.isNotEmpty) method,
          if (reference.isNotEmpty) 'Ref: $reference',
        ].join('  ·  ')),
        trailing: Text(_money(row['amount']),
            style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
      ),
    );
  }

  Future<void> _record() async {
    final staff = _selectedStaff;
    if (staff == null) {
      _snack('Select the staff member who paid');
      return;
    }
    final amount = num.tryParse(_amountController.text.trim()) ?? 0;
    if (amount <= 0) {
      _snack('Enter a valid amount');
      return;
    }
    final reference = _referenceController.text.trim();
    if (_method == 'mpesa' && reference.isEmpty) {
      _snack('Enter the M-Pesa reference code to record this payment');
      return;
    }
    setState(() => _submitting = true);
    try {
      await ref.read(cashierRepositoryProvider).recordPaidBill({
        'staff_id': staff.id,
        'staff_name': staff.name,
        'amount': amount,
        'payment_method': _method,
        if (reference.isNotEmpty) 'reference': reference,
      });
      _amountController.clear();
      _referenceController.clear();
      ref.invalidate(cashierPaidBillsProvider);
      ref.invalidate(cashierCurrentShiftProvider);
      ref.invalidate(cashierShiftsProvider);
      ref.invalidate(cashierStatsProvider);
      _snack('Paid credit of ${_money(amount)} recorded for ${staff.name}');
    } catch (error) {
      _snack('Failed to record paid credit: ${apiErrorMessage(error)}');
    } finally {
      if (mounted) setState(() => _submitting = false);
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
              ElevatedButton.icon(
                onPressed: canRequestShift ? _startShift : null,
                icon: const Icon(Icons.play_arrow, size: 16),
                label: Text(
                    hasPendingShift ? 'Awaiting Approval' : 'Open Shift'),
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
                      Padding(
                        padding: const EdgeInsets.only(bottom: 8),
                        child: Text(
                          '${_statusLabel(_status)} shift history',
                          style: Theme.of(context).textTheme.titleMedium,
                        ),
                      ),
                      ...rows.map((row) {
                        final status = _shiftStatus(row);
                        final isClosed =
                            status == 'closed' || status == 'reconciled';
                        final statusColor = _statusColor(status);
                        final shiftNum = _text(row, ['shift_number', 'id']);
                        final cashierName = _text(row, [
                          'cashier_name',
                          'opened_by_name',
                          'staff_name',
                          'user_name',
                        ]);
                        final openedAt = _date(
                          row['opened_at'] ??
                              row['shift_start'] ??
                              row['requested_at'] ??
                              row['start_time'],
                        );
                        final closedAt = isClosed
                            ? _date(
                                row['closed_at'] ??
                                    row['shift_end'] ??
                                    row['end_time'],
                              )
                            : null;

                        // Money values — shown only after shift is closed.
                        final showMoney = isClosed;
                        final baseCash =
                            _num(row['total_cash_sales'] ?? row['total_cash']);
                        final baseMpesa = _num(
                            row['total_mpesa_sales'] ?? row['total_mpesa']);
                        final baseCard =
                            _num(row['total_card_sales'] ?? row['total_card']);
                        final credits = _num(row['credit_bills_taken'] ??
                            row['total_credit'] ??
                            row['credit_bills_value']);
                        final closingFloat =
                            _num(row['closing_float'] ?? row['closing_cash']);
                        final expectedCash = _num(
                            row['expected_closing_float'] ??
                                row['expected_cash']);
                        final variance = closingFloat - expectedCash;

                        return Card(
                          margin: const EdgeInsets.only(bottom: 12),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(12),
                            side: BorderSide(
                              color: statusColor.withValues(alpha: 0.35),
                              width: 1.2,
                            ),
                          ),
                          child: ExpansionTile(
                            tilePadding: const EdgeInsets.symmetric(
                                horizontal: 16, vertical: 4),
                            childrenPadding:
                                const EdgeInsets.fromLTRB(16, 0, 16, 16),
                            leading: CircleAvatar(
                              backgroundColor:
                                  statusColor.withValues(alpha: 0.12),
                              child: Icon(Icons.access_time,
                                  color: statusColor, size: 18),
                            ),
                            title: Row(
                              children: [
                                Expanded(
                                  child: Text(
                                    shiftNum,
                                    style: const TextStyle(
                                        fontWeight: FontWeight.w700,
                                        fontSize: 14),
                                  ),
                                ),
                                Container(
                                  padding: const EdgeInsets.symmetric(
                                      horizontal: 8, vertical: 3),
                                  decoration: BoxDecoration(
                                    color: statusColor.withValues(alpha: 0.12),
                                    borderRadius: BorderRadius.circular(20),
                                  ),
                                  child: Text(
                                    _statusLabel(status).toUpperCase(),
                                    style: TextStyle(
                                      fontSize: 10,
                                      fontWeight: FontWeight.w700,
                                      color: statusColor,
                                      letterSpacing: 0.5,
                                    ),
                                  ),
                                ),
                              ],
                            ),
                            subtitle: Padding(
                              padding: const EdgeInsets.only(top: 2),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  if (cashierName.isNotEmpty)
                                    Text(
                                      cashierName,
                                      style: const TextStyle(
                                          fontWeight: FontWeight.w600,
                                          fontSize: 12),
                                    ),
                                  Text(
                                    'Opened: $openedAt'
                                    '${closedAt != null ? '  ·  Closed: $closedAt' : ''}',
                                    style: const TextStyle(
                                        fontSize: 11,
                                        color: AppColors.kTextSecondary),
                                  ),
                                ],
                              ),
                            ),
                            // Trailing summary row — only for closed shifts
                            trailing: showMoney
                                ? Column(
                                    mainAxisAlignment: MainAxisAlignment.center,
                                    crossAxisAlignment: CrossAxisAlignment.end,
                                    children: [
                                      Text(
                                        'Cash ${_money(closingFloat)}',
                                        style: const TextStyle(
                                            fontWeight: FontWeight.w700,
                                            fontSize: 13),
                                      ),
                                      Text(
                                        variance >= 0
                                            ? '+${_money(variance)}'
                                            : _money(variance),
                                        style: TextStyle(
                                          fontSize: 11,
                                          color: variance >= 0
                                              ? AppColors.kSuccess
                                              : AppColors.kError,
                                          fontWeight: FontWeight.w600,
                                        ),
                                      ),
                                    ],
                                  )
                                : null,
                            children: [
                              // ── Shift summary grid ──────────────────────
                              if (showMoney) ...[
                                // Full money breakdown for closed shifts
                                _LogbookSummaryGrid(
                                  entries: [
                                    _LogbookEntry('Opening float',
                                        _money(_num(row['opening_float']))),
                                    _LogbookEntry(
                                        'Cash sales', _money(baseCash),
                                        accent: AppColors.kSuccess),
                                    _LogbookEntry(
                                        'M-Pesa sales', _money(baseMpesa),
                                        accent: AppColors.kPrimary),
                                    _LogbookEntry(
                                        'Card sales', _money(baseCard)),
                                    _LogbookEntry(
                                        'Credit bills', _money(credits),
                                        accent: AppColors.kWarning),
                                    _LogbookEntry(
                                        'Expected cash', _money(expectedCash)),
                                    _LogbookEntry('Actual cash counted',
                                        _money(closingFloat),
                                        accent: AppColors.kSuccess),
                                    _LogbookEntry(
                                      'Variance',
                                      (variance >= 0 ? '+' : '') +
                                          _money(variance),
                                      accent: variance >= 0
                                          ? AppColors.kSuccess
                                          : AppColors.kError,
                                      bold: true,
                                    ),
                                  ],
                                ),
                              ] else ...[
                                // Open shifts: do not reveal financial figures
                                const Padding(
                                  padding: EdgeInsets.symmetric(vertical: 8),
                                  child: Row(
                                    children: [
                                      Icon(Icons.lock_outline,
                                          size: 14,
                                          color: AppColors.kTextSecondary),
                                      SizedBox(width: 6),
                                      Flexible(
                                        child: Text(
                                          'Financial totals are hidden until the shift is closed and reviewed by the branch accountant.',
                                          style: TextStyle(
                                              color: AppColors.kTextSecondary,
                                              fontSize: 12),
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              ],

                              // ── Credit bills breakdown ───────────────────
                              if (_creditBillDetails(row).isNotEmpty) ...[
                                const SizedBox(height: 10),
                                Align(
                                  alignment: Alignment.centerLeft,
                                  child: Text(
                                    'Credit bills',
                                    style: Theme.of(context)
                                        .textTheme
                                        .titleSmall
                                        ?.copyWith(fontWeight: FontWeight.w700),
                                  ),
                                ),
                                const SizedBox(height: 6),
                                for (final c in _creditBillDetails(row))
                                  Padding(
                                    padding:
                                        const EdgeInsets.symmetric(vertical: 3),
                                    child: Row(
                                      children: [
                                        const Icon(Icons.badge_outlined,
                                            size: 14,
                                            color: AppColors.kTextSecondary),
                                        const SizedBox(width: 6),
                                        Expanded(
                                          child: Text(
                                            _text(c, [
                                              'name',
                                              'staff_name',
                                              'customer_name'
                                            ]),
                                          ),
                                        ),
                                        Text(
                                          _money(
                                              c['amount'] ?? c['total_amount']),
                                          style: const TextStyle(
                                              fontWeight: FontWeight.w700),
                                        ),
                                      ],
                                    ),
                                  ),
                              ],

                              // ── Actions ─────────────────────────────────
                              const SizedBox(height: 12),
                              Row(
                                children: [
                                  if (status == 'open')
                                    FilledButton.icon(
                                      onPressed: () => _closeShift(row),
                                      icon: const Icon(Icons.stop_circle,
                                          size: 16),
                                      label: const Text(
                                          'Close Shift & Submit Logbook'),
                                      style: FilledButton.styleFrom(
                                        backgroundColor: AppColors.kError,
                                      ),
                                    )
                                  else if (status == 'pending_open')
                                    const Row(
                                      children: [
                                        Icon(Icons.hourglass_empty,
                                            size: 14,
                                            color: AppColors.kWarning),
                                        SizedBox(width: 6),
                                        Text(
                                          'Waiting for branch accountant approval',
                                          style: TextStyle(
                                            color: AppColors.kWarning,
                                            fontWeight: FontWeight.w600,
                                          ),
                                        ),
                                      ],
                                    )
                                  else
                                    Row(
                                      children: [
                                        Icon(Icons.check_circle,
                                            size: 14, color: statusColor),
                                        const SizedBox(width: 6),
                                        Text(
                                          'Logbook submitted to accountant',
                                          style: TextStyle(
                                            color: statusColor,
                                            fontWeight: FontWeight.w600,
                                            fontSize: 12,
                                          ),
                                        ),
                                      ],
                                    ),
                                ],
                              ),
                            ],
                          ),
                        );
                      }),
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
        await _numberDialog(context, 'Open Shift', 'Opening float');
    if (opening == null) return;
    try {
      await ref.read(cashierRepositoryProvider).startShift(opening);
      ref.invalidate(cashierShiftsProvider);
      ref.invalidate(cashierCurrentShiftProvider);
      _snack('Shift opened — you can start cashier operations.');
    } catch (error) {
      _snack('Open shift failed: ${apiErrorMessage(error)}');
    }
  }

  Future<void> _closeShift(Map<String, dynamic> row) async {
    final repo = ref.read(cashierRepositoryProvider);
    final shiftId = _text(row, ['id']);
    if (!mounted) return;

    // Staff is needed for credit bill and paid bill assignment.
    List<Map<String, dynamic>> staffMembers = const [];
    try {
      staffMembers = await repo.getBranchStaff();
    } catch (_) {
      // Non-fatal — logbook will still open with empty lists.
    }

    // Fetch the full shift log detail to obtain transactions and enriched credit bills
    Map<String, dynamic> shift = row;
    try {
      shift = await repo.getShift(shiftId);
    } catch (e) {
      debugPrint('Failed to load full shift details: $e');
    }

    if (!mounted) return;

    // Full logbook dialog — cash on drawer is mandatory before submitting.
    final payload = await _shiftCloseLogbookDialog(
      context,
      shift: shift,
      staffMembers: staffMembers,
    );
    if (payload == null) return;

    try {
      await repo.closeShift(shiftId, payload);
      ref.invalidate(cashierShiftsProvider);
      _snack('Shift closed. Cashier logbook submitted for accountant review.');
    } catch (error) {
      _snack('Close shift failed: ${apiErrorMessage(error)}');
    }
  }

  void _snack(String message) {
    if (!mounted) return;
    AppNotifier.show(context, message);
  }
}

/// A single key-value row used inside the logbook summary grid.
class _LogbookEntry {
  const _LogbookEntry(this.label, this.value, {this.accent, this.bold = false});
  final String label;
  final String value;
  final Color? accent;
  final bool bold;
}

/// A compact 2-column grid that renders logbook [_LogbookEntry] rows.
class _LogbookSummaryGrid extends StatelessWidget {
  const _LogbookSummaryGrid({required this.entries});
  final List<_LogbookEntry> entries;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: Theme.of(context)
            .colorScheme
            .surfaceContainerHighest
            .withValues(alpha: 0.4),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(
          color: Theme.of(context).dividerColor.withValues(alpha: 0.5),
        ),
      ),
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      child: Wrap(
        spacing: 0,
        runSpacing: 0,
        children: entries
            .map((entry) => SizedBox(
                  width: 200,
                  child: Padding(
                    padding: const EdgeInsets.symmetric(vertical: 5),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Expanded(
                          child: Text(
                            entry.label,
                            style: const TextStyle(
                              fontSize: 12,
                              color: AppColors.kTextSecondary,
                            ),
                          ),
                        ),
                        Text(
                          entry.value,
                          style: TextStyle(
                            fontSize: 12,
                            fontWeight:
                                entry.bold ? FontWeight.w800 : FontWeight.w600,
                            color: entry.accent,
                          ),
                        ),
                      ],
                    ),
                  ),
                ))
            .toList(),
      ),
    );
  }
}

// Lightweight fallback dialog (used if fetching stock/staff lists fails).
// ignore: unused_element
Future<Map<String, dynamic>?> _automatedShiftCloseDialog(BuildContext context) {
  final cashController = TextEditingController();
  final notesController = TextEditingController();
  return showDialog<Map<String, dynamic>>(
    context: context,
    barrierDismissible: false,
    builder: (context) {
      return StatefulBuilder(
        builder: (context, setState) {
          final cashText = cashController.text.trim();
          final cashVal = num.tryParse(cashText) ?? -1;
          final bool isValid = cashVal > 0;
          final bool showError = cashText.isNotEmpty && cashVal <= 0;

          return AlertDialog(
            title: const Row(
              children: [
                Icon(Icons.lock_clock, color: AppColors.kWarning, size: 22),
                SizedBox(width: 10),
                Text('Close Shift'),
              ],
            ),
            content: SizedBox(
              width: 420,
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: AppColors.kWarning.withValues(alpha: 0.08),
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(
                          color: AppColors.kWarning.withValues(alpha: 0.3)),
                    ),
                    child: const Text(
                      'You must count the cash in the drawer and enter the exact amount before closing. This is mandatory — the logbook will be sent to the branch accountant for reconciliation.',
                      style: TextStyle(fontSize: 13),
                    ),
                  ),
                  const SizedBox(height: 16),
                  TextField(
                    controller: cashController,
                    autofocus: true,
                    keyboardType:
                        const TextInputType.numberWithOptions(decimal: true),
                    onChanged: (_) => setState(() {}),
                    decoration: InputDecoration(
                      labelText: 'Cash in drawer *',
                      hintText: 'Enter amount counted in drawer',
                      prefixText: 'KES ',
                      errorText: showError
                          ? 'Enter a valid amount greater than 0'
                          : null,
                      border: const OutlineInputBorder(),
                    ),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: notesController,
                    maxLines: 2,
                    decoration: const InputDecoration(
                      labelText: 'Handover note (optional)',
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
              FilledButton.icon(
                icon: const Icon(Icons.archive, size: 16),
                onPressed: isValid
                    ? () {
                        final notes = notesController.text.trim();
                        Navigator.pop(context, {
                          'automation_mode': 'manual',
                          'actual_cash': cashVal,
                          'closing_float': cashVal,
                          if (notes.isNotEmpty) 'remarks': notes,
                        });
                      }
                    : null,
                label: const Text('Close Shift & Submit Logbook'),
              ),
            ],
          );
        },
      );
    },
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
    this.paymentMethod,
  });

  final String staffId;
  final String name;
  final num amount;
  final String? reference;
  // For paid credits: how the staff paid (cash / mpesa / card). Preserved so
  // the close-shift fold-by-method and the branch accountant see the method.
  final String? paymentMethod;

  Map<String, dynamic> toJson() => {
        'staff_id': staffId.isEmpty ? null : staffId,
        'name': name,
        'amount': amount,
        if (reference != null && reference!.isNotEmpty) 'reference': reference,
        if (paymentMethod != null && paymentMethod!.isNotEmpty)
          'payment_method': paymentMethod,
        'time': DateTime.now().toIso8601String(),
      };
}

// Shift expense entry — petty purchases/fuel/etc. paid out of this shift's
// collections. Deliberately separate from _ShiftCreditEntry: expenses have
// no staff member, just a free-text description and a payment method.
class _ShiftExpenseEntry {
  const _ShiftExpenseEntry({
    required this.description,
    required this.amount,
    required this.paymentMethod,
  });

  final String description;
  final num amount;
  final String paymentMethod;

  Map<String, dynamic> toJson() => {
        'description': description,
        'amount': amount,
        'payment_method': paymentMethod,
        'time': DateTime.now().toIso8601String(),
      };
}

List<_ShiftExpenseEntry> _shiftExpenseEntries(Map<String, dynamic> shift) {
  final entries = <_ShiftExpenseEntry>[];
  final value = shift['expense_details'];
  if (value is! List) return entries;
  for (final raw in value) {
    final row = _payload(raw);
    if (row.isEmpty) continue;
    final amount = _num(row['amount']);
    if (amount <= 0) continue;
    final description = _text(row, ['description', 'name']);
    final method = _text(row, ['payment_method', 'method']).toLowerCase();
    entries.add(_ShiftExpenseEntry(
      description: description.isEmpty ? 'Expense' : description,
      amount: amount,
      paymentMethod: method.isEmpty ? 'cash' : method,
    ));
  }
  return entries;
}

Widget _expenseEntryPanel(
  BuildContext context, {
  required TextEditingController description,
  required TextEditingController amount,
  required List<_ShiftExpenseEntry> entries,
  required ValueChanged<String> onAdd,
  required ValueChanged<int> onRemove,
}) {
  return _ExpenseEntryPanelBody(
    description: description,
    amount: amount,
    entries: entries,
    onAdd: onAdd,
    onRemove: onRemove,
  );
}

class _ExpenseEntryPanelBody extends StatefulWidget {
  const _ExpenseEntryPanelBody({
    required this.description,
    required this.amount,
    required this.entries,
    required this.onAdd,
    required this.onRemove,
  });

  final TextEditingController description;
  final TextEditingController amount;
  final List<_ShiftExpenseEntry> entries;
  final ValueChanged<String> onAdd;
  final ValueChanged<int> onRemove;

  @override
  State<_ExpenseEntryPanelBody> createState() => _ExpenseEntryPanelBodyState();
}

class _ExpenseEntryPanelBodyState extends State<_ExpenseEntryPanelBody> {
  String _method = 'cash';

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Wrap(
              spacing: 8,
              runSpacing: 8,
              crossAxisAlignment: WrapCrossAlignment.center,
              children: [
                SizedBox(
                  width: 260,
                  child: TextField(
                    controller: widget.description,
                    decoration:
                        const InputDecoration(labelText: 'Expense description'),
                  ),
                ),
                SizedBox(
                  width: 110,
                  child: TextField(
                    controller: widget.amount,
                    keyboardType: TextInputType.number,
                    decoration: const InputDecoration(labelText: 'Amount'),
                  ),
                ),
                SizedBox(
                  width: 140,
                  child: DropdownButtonFormField<String>(
                    initialValue: _method,
                    items: const [
                      DropdownMenuItem(value: 'cash', child: Text('Cash')),
                      DropdownMenuItem(value: 'mpesa', child: Text('M-Pesa')),
                      DropdownMenuItem(value: 'card', child: Text('Card')),
                    ],
                    onChanged: (value) {
                      if (value != null) setState(() => _method = value);
                    },
                    decoration: const InputDecoration(labelText: 'Paid via'),
                  ),
                ),
                IconButton.filled(
                  onPressed: () => widget.onAdd(_method),
                  icon: const Icon(Icons.add),
                ),
              ],
            ),
            if (widget.entries.isNotEmpty) ...[
              const SizedBox(height: 12),
              for (final entry in widget.entries.toList().asMap().entries)
                ListTile(
                  dense: true,
                  contentPadding: EdgeInsets.zero,
                  title: Text(entry.value.description),
                  subtitle: Text(
                      '${_money(entry.value.amount)} • ${entry.value.paymentMethod}'),
                  trailing: IconButton(
                    icon: const Icon(Icons.close, size: 18),
                    onPressed: () => widget.onRemove(entry.key),
                  ),
                ),
            ],
          ],
        ),
      ),
    );
  }
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
      initialValue:
          TextEditingValue(text: initial != null ? _label(initial) : ''),
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

Future<Map<String, dynamic>?> _shiftCloseLogbookDialog(
  BuildContext context, {
  required Map<String, dynamic> shift,
  required List<Map<String, dynamic>> staffMembers,
}) {
  final cashAtHand = TextEditingController();
  final mpesaLogged = TextEditingController();
  final cardLogged = TextEditingController();
  final mpesaSummaryRef = TextEditingController();
  final cardBatchRef = TextEditingController();
  final notesCtrl = TextEditingController();

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
  // Expenses are recorded mid-shift in the Expenses tab; loaded here read-only.
  final expenseEntries = _shiftExpenseEntries(shift);

  void disposeAll() {
    cashAtHand.dispose();
    mpesaLogged.dispose();
    cardLogged.dispose();
    mpesaSummaryRef.dispose();
    cardBatchRef.dispose();
    notesCtrl.dispose();
    creditStaffId.dispose();
    creditName.dispose();
    creditAmount.dispose();
    paidStaffId.dispose();
    paidName.dispose();
    paidAmount.dispose();
  }

  return showDialog<Map<String, dynamic>>(
    context: context,
    builder: (context) => StatefulBuilder(
      builder: (context, setDialogState) {
        final openingFloat = _num(shift['opening_float']);
        final rawCashSales =
            _num(shift['total_cash_sales'] ?? shift['total_cash']);
        final rawMpesaSales =
            _num(shift['total_mpesa_sales'] ?? shift['total_mpesa']);
        final rawCardSales =
            _num(shift['total_card_sales'] ?? shift['total_card']);
        // Paid credits recorded this shift, split by how the staff paid. Each
        // amount folds into the matching cashier collection tally.
        num paidByMethod(String method) => paidEntries
            .where((e) => (e.paymentMethod ?? 'cash').toLowerCase() == method)
            .fold<num>(0, (sum, entry) => sum + entry.amount);
        final cashPaidCredits = paidByMethod('cash');
        final paidBillsTotal =
            paidEntries.fold<num>(0, (sum, entry) => sum + entry.amount);
        final creditBillsTotal =
            creditEntries.fold<num>(0, (sum, entry) => sum + entry.amount);
        // Expenses logged this shift, split by how they were paid out. Each
        // reduces that method's reported sales — mirrors the backend's
        // cash_sales_net/mpesa_sales_net/card_sales_net at close time.
        num expenseByMethod(String method) => expenseEntries
            .where((e) => e.paymentMethod.toLowerCase() == method)
            .fold<num>(0, (sum, entry) => sum + entry.amount);
        final cashExpenses = expenseByMethod('cash');
        final mpesaExpenses = expenseByMethod('mpesa');
        final cardExpenses = expenseByMethod('card');
        final expenseTotal =
            expenseEntries.fold<num>(0, (sum, entry) => sum + entry.amount);
        final baseCashSales =
            (rawCashSales - cashExpenses).clamp(0, rawCashSales);
        final baseMpesaSales =
            (rawMpesaSales - mpesaExpenses).clamp(0, rawMpesaSales);
        final baseCardSales =
            (rawCardSales - cardExpenses).clamp(0, rawCardSales);
        final actualCash = num.tryParse(cashAtHand.text.trim()) ?? 0;
        // Cash-drawer reconciliation legitimately includes paid credits (the
        // cashier is physically holding that cash) and excludes cash spent on
        // expenses (it physically left the drawer) — but this must stay
        // separate from "sales" below, which only ever shows true revenue net
        // of expenses, matching what the backend now persists. Otherwise a
        // settled credit bill gets counted as a sale twice: once when the
        // credit was originally issued, again here when it's collected.
        // cash_deposited is not a cashier-declared deposit — exclude it from
        // the drawer formula to avoid inflating/deflating the expected cash.
        final expectedCash =
            openingFloat + rawCashSales + cashPaidCredits - cashExpenses;
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
                          'Net sales': _money(
                              baseCashSales + baseMpesaSales + baseCardSales),
                          'Credit bills': _money(creditBillsTotal),
                          'Paid bills': _money(paidBillsTotal),
                          'Expenses': _money(expenseTotal),
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
                            _amountField(cashAtHand, 'Cash at hand (incl. Opening Float)',
                                onChanged: (_) => setDialogState(() {})),
                            _amountField(mpesaLogged, 'M-Pesa total collected',
                                onChanged: (_) => setDialogState(() {})),
                            _amountField(cardLogged, 'Card total collected',
                                onChanged: (_) => setDialogState(() {})),
                          ],
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
                              title: 'Credit bill',
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
                              title: 'Paid bill',
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
                                  paymentMethod: 'cash',
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
                        if (expenseEntries.isNotEmpty) ...[
                          const SizedBox(height: 24),
                          Text('Expenses recorded this shift (read-only)',
                              style: Theme.of(context).textTheme.titleMedium),
                          const SizedBox(height: 4),
                          const Text(
                            'Recorded via the Expenses tab during the shift. Total reduces expected cash.',
                            style: TextStyle(
                                color: AppColors.kTextSecondary, fontSize: 12),
                          ),
                          const SizedBox(height: 8),
                          ...expenseEntries.map((e) => Padding(
                                padding:
                                    const EdgeInsets.symmetric(vertical: 2),
                                child: Row(children: [
                                  Expanded(child: Text(e.description)),
                                  Text(e.paymentMethod.toUpperCase(),
                                      style: const TextStyle(
                                          fontSize: 11,
                                          color: AppColors.kTextSecondary)),
                                  const SizedBox(width: 12),
                                  Text(_money(e.amount),
                                      style: const TextStyle(
                                          fontWeight: FontWeight.w600)),
                                ]),
                              )),
                        ],
                        const SizedBox(height: 24),
                        Text('Notes',
                            style: Theme.of(context).textTheme.titleMedium),
                        const SizedBox(height: 8),
                        TextField(
                          controller: notesCtrl,
                          maxLines: 2,
                          decoration: const InputDecoration(
                            hintText: 'Handover notes, observations…',
                          ),
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
                          if (cashAtHand.text.trim().isEmpty) return;
                          Navigator.pop(context, {
                            'closing_float':
                                num.tryParse(cashAtHand.text.trim()) ?? 0,
                            'actual_cash_counted':
                                num.tryParse(cashAtHand.text.trim()) ?? 0,
                            'cash_at_hand':
                                num.tryParse(cashAtHand.text.trim()) ?? 0,
                            'actual_mpesa_logged':
                                num.tryParse(mpesaLogged.text.trim()),
                            'actual_card_logged':
                                num.tryParse(cardLogged.text.trim()),
                            'notes': notesCtrl.text.trim(),
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
                            'expense_total': expenseTotal,
                            'payouts': expenseTotal,
                            'paid_outs': expenseTotal,
                            'expense_details': expenseEntries
                                .map((entry) => entry.toJson())
                                .toList(),
                            'unpaid_bills_value': creditBillsTotal,
                            'unpaid_bills_count': creditEntries.length,
                            if (mpesaSummaryRef.text.trim().isNotEmpty)
                              'mpesa_summary_ref': mpesaSummaryRef.text.trim(),
                            if (cardBatchRef.text.trim().isNotEmpty)
                              'card_batch_ref': cardBatchRef.text.trim(),
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
    final method = _text(row, ['payment_method', 'method']);
    // Include a unique discriminator so two legitimate same-amount paid credits
    // for the same staff are not collapsed into one.
    final discriminator = _text(row, ['id', 'recorded_at', 'time']);
    final key = '$staffId|$amount|$reference|$discriminator';
    if (!seen.add(key)) return;
    final staff = _shiftStaffById(staffMembers, staffId);
    entries.add(_ShiftCreditEntry(
      staffId: staffId,
      name: name.isEmpty ? staff?.name ?? '' : name,
      amount: amount,
      reference: reference.isEmpty ? null : reference,
      paymentMethod: method.isEmpty ? null : method.toLowerCase(),
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

/// Full-screen camera barcode scanner used by the Station tab. Returns the
/// scanned raw value to the caller via Navigator.pop, or null if cancelled.
class _CashierBarcodeScannerScreen extends StatefulWidget {
  const _CashierBarcodeScannerScreen();

  @override
  State<_CashierBarcodeScannerScreen> createState() =>
      _CashierBarcodeScannerScreenState();
}

class _CashierBarcodeScannerScreenState
    extends State<_CashierBarcodeScannerScreen> {
  final MobileScannerController _controller = MobileScannerController(
    detectionSpeed: DetectionSpeed.noDuplicates,
    returnImage: false,
  );
  bool _handled = false;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _onDetect(BarcodeCapture capture) {
    if (_handled) return;
    final barcode = capture.barcodes.isNotEmpty ? capture.barcodes.first : null;
    final code = barcode?.rawValue;
    if (code == null || code.trim().isEmpty) return;
    _handled = true;
    HapticFeedback.lightImpact();
    Navigator.of(context).pop(code.trim());
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        backgroundColor: Colors.black,
        foregroundColor: Colors.white,
        title: const Text('Scan Barcode'),
        actions: [
          IconButton(
            icon: const Icon(Icons.flash_on),
            onPressed: () => _controller.toggleTorch(),
          ),
          IconButton(
            icon: const Icon(Icons.cameraswitch),
            onPressed: () => _controller.switchCamera(),
          ),
        ],
      ),
      body: Stack(
        fit: StackFit.expand,
        children: [
          MobileScanner(controller: _controller, onDetect: _onDetect),
          // Simple framing guide
          Center(
            child: Container(
              width: 260,
              height: 160,
              decoration: BoxDecoration(
                border: Border.all(color: Colors.white70, width: 2),
                borderRadius: BorderRadius.circular(12),
              ),
            ),
          ),
          Positioned(
            left: 0,
            right: 0,
            bottom: 40,
            child: Text(
              'Point the camera at the bill barcode',
              textAlign: TextAlign.center,
              style: TextStyle(color: Colors.white.withValues(alpha: 0.85)),
            ),
          ),
        ],
      ),
    );
  }
}

class _InsightsTab extends ConsumerWidget {
  const _InsightsTab();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final currentShift = ref.watch(cashierCurrentShiftProvider);
    final reconciliation = ref.watch(cashierReconciliationProvider);
    final insights = ref.watch(cashierInsightsProvider);
    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _CurrentShiftBanner(value: currentShift),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                child: _AsyncStatCard(
                  value: currentShift,
                  label: 'Cash',
                  keys: const ['total_cash_sales', 'total_cash', 'cash_total'],
                  icon: Icons.money,
                  color: AppColors.kSuccess,
                  paidMethod: 'cash',
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: _AsyncStatCard(
                  value: currentShift,
                  label: 'M-Pesa',
                  keys: const [
                    'total_mpesa_sales',
                    'total_mpesa',
                    'mpesa_total'
                  ],
                  icon: Icons.phone_android,
                  color: AppColors.kPrimary,
                  paidMethod: 'mpesa',
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: _AsyncStatCard(
                  value: currentShift,
                  label: 'Card',
                  keys: const ['total_card_sales', 'total_card', 'card_total'],
                  icon: Icons.credit_card,
                  color: AppColors.kAccent,
                  paidMethod: 'card',
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: _AsyncStatCard(
                  value: currentShift,
                  label: 'Credit Bills',
                  keys: const [
                    'credit_bills_taken',
                    'total_credit_bill',
                    'credit_bill_total'
                  ],
                  icon: Icons.credit_score,
                  color: AppColors.kWarning,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: _AsyncStatCard(
                  value: currentShift,
                  label: 'Paid Credits',
                  keys: const [],
                  icon: Icons.task_alt,
                  color: AppColors.kPrimary,
                  paidMethod: 'total',
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
                    data: (data) {
                      final payload = _payload(data);
                      return payload.isEmpty
                          ? const EmptyState(
                              message: 'Insights service unavailable')
                          : _PosInsights(data: payload);
                    },
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

class _CurrentShiftBanner extends StatelessWidget {
  const _CurrentShiftBanner({required this.value});

  final AsyncValue<Map<String, dynamic>> value;

  @override
  Widget build(BuildContext context) {
    return value.when(
      loading: () => const LoadingSkeleton(type: SkeletonType.card),
      error: (_, __) => const SizedBox.shrink(),
      data: (raw) {
        final shift = _payload(raw);
        if (shift.isEmpty) {
          return Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: AppColors.kWarning.withValues(alpha: 0.08),
              borderRadius: BorderRadius.circular(12),
              border:
                  Border.all(color: AppColors.kWarning.withValues(alpha: 0.3)),
            ),
            child: const Row(children: [
              Icon(Icons.info_outline, color: AppColors.kWarning, size: 20),
              SizedBox(width: 10),
              Expanded(
                child: Text(
                  'No open shift. Start a shift to see live insights for your current session.',
                  style: TextStyle(fontWeight: FontWeight.w600),
                ),
              ),
            ]),
          );
        }
        final shiftNo = _text(shift, ['shift_number', 'id']);
        final status = _text(shift, ['status']);
        final isOpen = status.toLowerCase() == 'open' ||
            status.toLowerCase() == 'pending_open' ||
            status.isEmpty;
        final paidCredits = _shiftPaidCredits(shift)['total'] ?? 0;
        final totalSales =
            _num(shift['total_sales']) + (isOpen ? paidCredits : 0);
        final txns = _num(shift['transaction_count']).toInt();
        return Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: AppColors.kPrimary.withValues(alpha: 0.06),
            borderRadius: BorderRadius.circular(12),
            border:
                Border.all(color: AppColors.kPrimary.withValues(alpha: 0.2)),
          ),
          child: Row(children: [
            const Icon(Icons.point_of_sale,
                color: AppColors.kPrimary, size: 22),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    shiftNo.isEmpty ? 'Current Shift' : 'Shift $shiftNo',
                    style: const TextStyle(
                        fontSize: 15, fontWeight: FontWeight.bold),
                  ),
                  Text(
                    '$txns transactions this shift',
                    style: const TextStyle(
                        fontSize: 12, color: AppColors.kTextSecondary),
                  ),
                ],
              ),
            ),
            Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
              if (status.isNotEmpty)
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: AppColors.kSuccess.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(999),
                  ),
                  child: Text(status.toUpperCase(),
                      style: const TextStyle(
                          fontSize: 10,
                          fontWeight: FontWeight.bold,
                          color: AppColors.kSuccess)),
                ),
              const SizedBox(height: 4),
              Text('Total ${_money(totalSales)}',
                  style: const TextStyle(
                      fontSize: 15, fontWeight: FontWeight.bold)),
            ]),
          ]),
        );
      },
    );
  }
}

class _PosInsights extends StatelessWidget {
  const _PosInsights({required this.data});

  final Map<String, dynamic> data;

  @override
  Widget build(BuildContext context) {
    final topItems = _asList(data['top_items']);
    final paymentMix = _asList(data['payment_mix']);
    final heatmap = _asList(data['hourly_heatmap']);

    if (topItems.isEmpty && paymentMix.isEmpty && heatmap.isEmpty) {
      return const EmptyState(message: 'No POS activity in the last 7 days');
    }

    String peakHour() {
      if (heatmap.isEmpty) return '—';
      final peak = heatmap
          .reduce((a, b) => _num(a['count']) >= _num(b['count']) ? a : b);
      final hour = _num(peak['hour']).toInt();
      return '${hour.toString().padLeft(2, '0')}:00';
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('Last 7 days · your branch',
            style: TextStyle(
                fontSize: 11,
                color: AppColors.kTextSecondary.withValues(alpha: 0.9))),
        const SizedBox(height: 12),
        if (paymentMix.isNotEmpty) ...[
          const Text('Payment Mix',
              style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
          const SizedBox(height: 6),
          ...paymentMix.map((m) => Padding(
                padding: const EdgeInsets.symmetric(vertical: 3),
                child: Row(children: [
                  Expanded(
                      child: Text(_methodLabel(_text(m, ['payment_method'])),
                          style: const TextStyle(fontSize: 13))),
                  Text(_money(m['total_amount']),
                      style: const TextStyle(
                          fontSize: 13, fontWeight: FontWeight.w600)),
                ]),
              )),
          const SizedBox(height: 16),
        ],
        if (topItems.isNotEmpty) ...[
          const Text('Top Selling Items',
              style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
          const SizedBox(height: 6),
          ...topItems.take(5).map((it) => Padding(
                padding: const EdgeInsets.symmetric(vertical: 3),
                child: Row(children: [
                  Expanded(
                      child: Text(
                          _text(it, ['name']).isEmpty
                              ? 'Item'
                              : _text(it, ['name']),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(fontSize: 13))),
                  Text('${_num(it['qty']).toInt()} sold',
                      style: const TextStyle(
                          fontSize: 12, color: AppColors.kTextSecondary)),
                  const SizedBox(width: 12),
                  Text(_money(it['line_total']),
                      style: const TextStyle(
                          fontSize: 13, fontWeight: FontWeight.w600)),
                ]),
              )),
          const SizedBox(height: 16),
        ],
        if (heatmap.isNotEmpty)
          Row(children: [
            const Icon(Icons.schedule,
                size: 16, color: AppColors.kTextSecondary),
            const SizedBox(width: 6),
            Text('Peak hour: ${peakHour()}',
                style:
                    const TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
          ]),
      ],
    );
  }

  String _methodLabel(String m) =>
      m.isEmpty ? 'Other' : (m[0].toUpperCase() + m.substring(1));

  List<Map<String, dynamic>> _asList(dynamic value) {
    if (value is List) {
      return value
          .whereType<Map>()
          .map((e) => Map<String, dynamic>.from(e))
          .toList();
    }
    return const [];
  }
}

class _BillsScaffold extends StatelessWidget {
  const _BillsScaffold({
    required this.title,
    required this.status,
    required this.onStatusChanged,
    required this.onSearch,
    required this.child,
  });

  final String title;
  final String status;
  final ValueChanged<String?> onStatusChanged;
  final ValueChanged<String> onSearch;
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
    this.onPrint,
  });

  final List<Map<String, dynamic>> rows;
  final String emptyMessage;

  /// When null, no payment action is shown (e.g. credit bills are settled by
  /// the branch accountant, not the cashier).
  final ValueChanged<Map<String, dynamic>>? onPay;
  final ValueChanged<Map<String, dynamic>>? onPrint;

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
            subtitle: Builder(builder: (context) {
              final customer = _text(row, ['customer_name', 'guest_name']);
              // Show the waiter on every waiter-placed order regardless of
              // customer/table name, so any cashier in any outlet can tell
              // who is holding the bill. Credit bills (no is_waiter_order
              // flag) are assigned to a staff member instead, not a waiter.
              final showWaiter = row['is_waiter_order'] == true;
              return Text(
                [
                  if (_text(row, ['short_code', 'scan_reference']).isNotEmpty)
                    'Code ${_text(row, ['short_code', 'scan_reference'])}',
                  if (showWaiter && _text(row, ['waiter_name']).isNotEmpty)
                    'Waiter ${_text(row, ['waiter_name'])}',
                  if (customer.isNotEmpty) customer,
                  status,
                ].join(' - '),
              );
            }),
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
                if (row['is_waiter_order'] == true)
                  'Waiter': _text(row, ['waiter_name']),
                'Date': _date(row['bill_date'] ?? row['created_at']),
                if (_text(row, [
                  'last_bill_printed_at',
                  'captain_printed_at',
                  'original_bill_printed_at'
                ]).isNotEmpty)
                  'Last printed': _date(row['last_bill_printed_at'] ??
                      row['captain_printed_at'] ??
                      row['original_bill_printed_at']),
                'Total': _money(row['total_amount'] ?? row['amount']),
                'Paid': _money(row['paid_amount'] ?? row['amount_paid']),
                'Balance': _money(row['balance_amount'] ?? row['balance']),
                'Station': _text(row, ['station_name', 'outlet_name']),
                'Void reason': _text(row, ['void_reason']),
                'Voided at': _date(row['voided_at']),
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
                  Builder(builder: (context) {
                    final rawQty = _num(item['quantity'] ?? item['qty']);
                    final voidedQty = _num(item['voided_qty'] ?? 0);
                    final activeQty =
                        _num(item['active_qty'] ?? (rawQty - voidedQty));
                    final unitPrice = _num(item['unit_price'] ?? item['price']);
                    final isFullyVoided = activeQty <= 0;
                    final displayQty = isFullyVoided ? rawQty : activeQty;
                    final activeTotal =
                        _num(item['active_total'] ?? (activeQty * unitPrice));
                    final originalTotal = _num(item['total_price'] ??
                        item['line_total'] ??
                        item['total']);
                    return ListTile(
                      dense: true,
                      contentPadding: EdgeInsets.zero,
                      title: Text(
                        _text(item, [
                              'item_name',
                              'name',
                              'description',
                              'drink_name'
                            ]) +
                            (voidedQty > 0 && !isFullyVoided
                                ? ' (${voidedQty.toStringAsFixed(0)} voided)'
                                : ''),
                        style: isFullyVoided
                            ? const TextStyle(
                                decoration: TextDecoration.lineThrough,
                                color: Colors.red)
                            : null,
                      ),
                      trailing: Text(
                        '${displayQty.toStringAsFixed(0)} x ${_money(unitPrice)}',
                        style: isFullyVoided
                            ? const TextStyle(
                                decoration: TextDecoration.lineThrough,
                                color: Colors.red)
                            : null,
                      ),
                      subtitle: Text(
                        isFullyVoided
                            ? 'VOIDED • was ${_money(originalTotal)}'
                            : _money(activeTotal),
                        style: isFullyVoided
                            ? const TextStyle(color: Colors.red)
                            : null,
                      ),
                    );
                  }),
              ],
              const SizedBox(height: 8),
              if (onPay != null || onPrint != null)
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    if (onPay != null)
                      OutlinedButton.icon(
                        onPressed: () => onPay!(row),
                        icon: const Icon(Icons.payments, size: 16),
                        label: const Text('Confirm Payment'),
                      ),
                    if (onPrint != null)
                      OutlinedButton.icon(
                        onPressed: () => onPrint!(row),
                        icon: const Icon(Icons.print, size: 16),
                        label: const Text('Print Void Order'),
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
          if (_waiterName(bill).isNotEmpty) 'Waiter': _waiterName(bill),
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
              final rawQty = _num(item['quantity'] ?? item['qty']);
              final voidedQty = _num(item['voided_qty'] ?? 0);
              final activeQty =
                  _num(item['active_qty'] ?? (rawQty - voidedQty));
              final unitPrice = _num(item['unit_price'] ?? item['price']);
              final isFullyVoided = activeQty <= 0;
              final displayQty = isFullyVoided ? rawQty : activeQty;
              final activeTotal =
                  _num(item['active_total'] ?? (activeQty * unitPrice));
              return ListTile(
                dense: true,
                contentPadding: EdgeInsets.zero,
                title: Text(
                  _text(item, ['name', 'description', 'item_name']) +
                      (voidedQty > 0 && !isFullyVoided
                          ? ' (${voidedQty.toStringAsFixed(0)} voided)'
                          : ''),
                  style: isFullyVoided
                      ? const TextStyle(
                          decoration: TextDecoration.lineThrough,
                          color: Colors.red)
                      : null,
                ),
                subtitle: Text(
                  'Qty ${displayQty.toStringAsFixed(0)}',
                  style:
                      isFullyVoided ? const TextStyle(color: Colors.red) : null,
                ),
                trailing: Text(
                  isFullyVoided ? 'VOIDED' : _money(activeTotal),
                  style: isFullyVoided
                      ? const TextStyle(
                          color: Colors.red, fontWeight: FontWeight.w600)
                      : null,
                ),
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

class _MiniMeta extends StatelessWidget {
  const _MiniMeta({required this.icon, required this.text});

  final IconData icon;
  final String text;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: AppColors.kSurface,
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: AppColors.kDivider),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 13, color: AppColors.kTextSecondary),
          const SizedBox(width: 4),
          ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 180),
            child: Text(
              text,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                fontSize: 11,
                color: AppColors.kTextSecondary,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
        ],
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
    this.paidMethod,
  });

  final AsyncValue<Map<String, dynamic>> value;
  final String label;
  final List<String> keys;
  final IconData icon;
  final Color color;
  // When set ('cash' | 'mpesa' | 'card' | 'total'), the matching paid credits
  // recorded on the (open) shift are folded into the displayed amount.
  final String? paidMethod;

  @override
  Widget build(BuildContext context) {
    return value.when(
      data: (data) {
        final s = _payload(data);
        final base = _num(keys.map((key) => s[key]).firstWhere(
              (item) => item != null,
              orElse: () => 0,
            ));
        num amount = base;
        if (paidMethod != null) {
          final status = _shiftStatus(s);
          final isOpen =
              status == 'open' || status == 'pending_open' || status.isEmpty;
          if (isOpen) {
            amount += _shiftPaidCredits(s)[paidMethod] ?? 0;
          }
        }
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
        // Cash overpayment becomes change handed back to the customer.
        final cashTendered = lines
            .where((line) => line.method == 'cash')
            .fold<num>(0, (sum, line) => sum + line.amount);
        final overpay =
            amount > 0 && allocated > amount ? allocated - amount : 0;
        final changeDue =
            overpay > 0 && overpay <= cashTendered + 0.001 ? overpay : 0;
        final overpaidByNonCash = overpay > 0 && overpay > cashTendered + 0.001;

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
                    content:
                        Text('Select the staff member for the credit bill')),
              );
              return null;
            }
            // M-Pesa lines must be cleared against a reference code — never
            // accepted blind.
            if (line.method == 'mpesa' &&
                line.amount > 0 &&
                line.referenceController.text.trim().isEmpty) {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(
                    content: Text(
                        'Enter the M-Pesa reference code for the M-Pesa payment line')),
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
          num changeGiven = 0;
          num amountTendered = 0;
          var applied = payments;
          if (amount > 0 && total > amount) {
            final cashTotal = payments
                .where((p) => p['payment_method'] == 'cash')
                .fold<num>(0, (sum, p) => sum + _num(p['payment_amount']));
            final overAmount = total - amount;
            // Overpayment is only valid when covered by cash (it becomes change).
            if (overAmount > cashTotal + 0.001) {
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(
                  content: Text(
                    'Payment exceeds balance by ${_money(overAmount)}. Only cash overpayment is allowed (returned as change).',
                  ),
                ),
              );
              return null;
            }
            changeGiven = overAmount;
            amountTendered = cashTotal;
            // Cap the recorded cash so the applied total equals the balance.
            num cut = overAmount;
            applied = payments
                .map((p) {
                  final m = Map<String, dynamic>.from(p);
                  if (cut > 0 && p['payment_method'] == 'cash') {
                    final amt = _num(p['payment_amount']);
                    final reduce = amt >= cut ? cut : amt;
                    m['payment_amount'] = amt - reduce;
                    cut -= reduce;
                  }
                  return m;
                })
                .where((p) => _num(p['payment_amount']) > 0)
                .toList();
          }

          final extras = <String, dynamic>{
            if (changeGiven > 0) 'change_given': changeGiven,
            if (amountTendered > 0) 'amount_tendered': amountTendered,
          };
          if (applied.length == 1) return {...applied.first, ...extras};
          final appliedTotal =
              applied.fold<num>(0, (sum, p) => sum + _num(p['payment_amount']));
          return {
            'payment_amount': appliedTotal,
            'payment_method': 'split',
            'payment_reference': applied
                .map((payment) => _text(payment, ['payment_reference']))
                .where((reference) => reference.isNotEmpty)
                .join(' / '),
            'payments': applied,
            ...extras,
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
                        if (changeDue > 0)
                          Text(
                            'Change to give: ${_money(changeDue)}',
                            style: const TextStyle(
                              color: AppColors.kSuccess,
                              fontWeight: FontWeight.w700,
                            ),
                          )
                        else if (overpaidByNonCash)
                          Text(
                            'Overpaid by ${_money(overpay)} (only cash overpayment allowed)',
                            style: const TextStyle(
                              color: AppColors.kError,
                              fontWeight: FontWeight.w700,
                            ),
                          )
                        else
                          Text(
                            'Remaining: ${_money(remaining > 0 ? remaining : 0)}',
                            style: const TextStyle(
                              color: AppColors.kTextSecondary,
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
              labelText: line.method == 'cash'
                  ? 'Reference (optional)'
                  : line.method == 'mpesa'
                      ? 'M-Pesa Reference (required)'
                      : 'Reference',
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

List<Map<String, dynamic>> _withCashAudit(
  List<Map<String, dynamic>> payments,
  num amountTendered,
  num changeGiven,
) {
  if (amountTendered <= 0 && changeGiven <= 0) return payments;
  var attached = false;
  return payments.map((payment) {
    final copy = Map<String, dynamic>.from(payment);
    final method = _backendPaymentMethod(_text(copy, ['payment_method']));
    if (!attached && method == 'cash') {
      if (amountTendered > 0) copy['amount_tendered'] = amountTendered;
      if (changeGiven > 0) copy['change_given'] = changeGiven;
      attached = true;
    }
    return copy;
  }).toList();
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

String _billId(Map<String, dynamic> bill) {
  final direct = _text(bill, ['id']);
  if (direct.isNotEmpty) return direct;
  for (final nestedKey in ['order', 'booking', 'invoice', 'bill', 'transaction']) {
    final nested = _asMap(bill[nestedKey]);
    final nestedId = _text(nested, ['id']);
    if (nestedId.isNotEmpty) return nestedId;
  }
  return '';
}

/// Finds a bill's real short_code, which getBillDetails nests under a
/// different sub-key depending on bill type (order/invoice/payment/booking/
/// bill/transaction/etc.) rather than always at the top level. Checks the
/// top level first, then one level of nesting into any sub-map.
String _billShortCode(Map<String, dynamic> bill) {
  final direct = _text(bill, ['short_code', 'shortCode']);
  if (direct.isNotEmpty) return direct;
  for (final value in bill.values) {
    if (value is Map) {
      final nested =
          _text(Map<String, dynamic>.from(value), ['short_code', 'shortCode']);
      if (nested.isNotEmpty) return nested;
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

// Paid credits recorded on a shift, split by how the staff paid.
Map<String, num> _shiftPaidCredits(Map<String, dynamic> row) {
  final result = <String, num>{'cash': 0, 'mpesa': 0, 'card': 0, 'total': 0};
  final raw = row['paid_bills_details'] ?? row['paid_bills'];
  if (raw is List) {
    for (final item in raw) {
      final entry = _payload(item);
      final amount = _num(entry['amount']);
      if (amount <= 0) continue;
      final method = _text(entry, ['payment_method', 'method']).toLowerCase();
      final key = method.contains('mpesa') || method.contains('m-pesa')
          ? 'mpesa'
          : method.contains('card') || method.contains('swipe')
              ? 'card'
              : 'cash';
      result[key] = result[key]! + amount;
      result['total'] = result['total']! + amount;
    }
  }
  // No detail rows but a stored total — show it (cannot fold by method).
  if (result['total'] == 0) {
    result['total'] = _num(row['paid_bills_value']);
  }
  return result;
}

// Choose a short, human/scannable CREDIT BILL CODE for the receipt. Avoid raw
// UUIDs (staff_credit_bill_id): prefer a real credit number, else the order's
// short code, else the order number.
String _creditCodeForReceipt(
    Map<String, dynamic> row, Map<String, dynamic> created, String reference) {
  bool looksLikeUuid(String s) =>
      RegExp(r'^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-').hasMatch(s);
  final cn = _text(created, ['bill_number', 'credit_number']);
  if (cn.isNotEmpty && !looksLikeUuid(cn)) return cn;
  final short = _text(row, ['short_code', 'scan_reference']);
  if (short.isNotEmpty) return short;
  final orderNo = _text(row, ['bill_number', 'order_number']);
  if (orderNo.isNotEmpty) return orderNo;
  return reference;
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
//
// Kenya has a fixed UTC+3 offset with no DST, so timestamps are converted
// with a plain offset rather than DateTime.toLocal() — the device's own
// timezone can't be trusted to be Kenya time (e.g. a tablet left on UTC or
// misconfigured), which previously made bill dates/times shown here wrong.
DateTime _toKenyaTime(DateTime value) =>
    value.toUtc().add(const Duration(hours: 3));

String _date(dynamic value) {
  if (value == null || value.toString().isEmpty) return '-';
  final parsed = DateTime.tryParse(value.toString());
  if (parsed == null) return value.toString();
  return DateFormat('MMM d, yyyy HH:mm').format(_toKenyaTime(parsed));
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
  num amountTendered = 0,
  num changeGiven = 0,
}) async {
  final payload = _payload(response);
  final data = _payload(payload['data']);
  final reference =
      _text(data, ['reference', 'transaction_number', 'id']).isNotEmpty
          ? _text(data, ['reference', 'transaction_number', 'id'])
          : fallbackReference;
  final nav = ref.read(dashboardNavProvider);
  final methodLabel = _receiptMethodLabel(method);
  final outletId = _text(bill, ['outlet_id', 'outletId']).isNotEmpty
      ? _text(bill, ['outlet_id', 'outletId'])
      : nav.user?.outletId;
  await printCustomerDocument(
    ref,
    templateKey: 'customer_receipt',
    fallbackTitle: 'CUSTOMER RECEIPT',
    branchId: nav.user?.branchId,
    outletId: outletId,
    sale: SaleResult(
      transactionId: reference.isEmpty ? DateTime.now().toString() : reference,
      createdAt: DateTime.now(),
      receiptNumber: reference.isEmpty ? null : reference,
      cashierName: nav.user?.name,
      total: amount.toDouble(),
      paymentMethod: methodLabel,
    ),
    items: _receiptItemsFromBill(bill, amount),
    branchName: nav.branchName,
    customerName: _customerName(bill),
    publicCode: _text(bill, [
      'short_code',
      'shortCode',
      'bill_number',
      'order_number',
      'invoice_number'
    ]),
    amountTendered: amountTendered,
    changeGiven: changeGiven,
  );
}

List<CartItem> _receiptItemsFromBill(Map<String, dynamic> bill, num amount) {
  final items = _billItems(bill)
      .map((item) {
        final rawQty = _num(item['quantity'] ?? item['qty']);
        final voidedQty = _num(item['voided_qty'] ?? 0);
        final activeQty = _num(item['active_qty'] ?? (rawQty - voidedQty));
        if (activeQty <= 0) return null;
        final unitPrice = _num(item['unit_price'] ?? item['price']);
        final activeTotal = _num(item['active_total'] ?? activeQty * unitPrice);
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
              : (activeQty > 0
                  ? (activeTotal / activeQty).toDouble()
                  : activeTotal.toDouble()),
          qty: activeQty.round() > 0 ? activeQty.round() : 1,
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

String _billLookupReference(Map<String, dynamic> bill) {
  final direct = _text(bill, [
    'short_code',
    'scan_reference',
    'order_number',
    'bill_number',
    'invoice_number',
    'confirmation_number',
    'transaction_ref',
    'reference',
    'id',
  ]);
  if (direct.isNotEmpty) return direct;
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
      'scan_reference',
      'booking_number',
      'order_number',
      'bill_number',
      'invoice_number',
      'confirmation_number',
      'transaction_ref',
      'reference',
      'id',
    ]);
    if (value.isNotEmpty) return value;
  }
  return '';
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

// Captain orders placed for a walk-in customer (no named guest) still carry
// the waiter who rang them in — pull it out wherever the lookup response
// ─── Shift Expenses / Petty Cash Tab ────────────────────────────────────────

const _kExpenseCategories = [
  'SUPPLIES',
  'FUEL',
  'TRANSPORT',
  'REPAIRS',
  'MAINTENANCE',
  'OTHER',
];

class _ShiftExpensesTab extends ConsumerStatefulWidget {
  const _ShiftExpensesTab();

  @override
  ConsumerState<_ShiftExpensesTab> createState() => _ShiftExpensesTabState();
}

class _ShiftExpensesTabState extends ConsumerState<_ShiftExpensesTab> {
  List<Map<String, dynamic>> _expenses = [];
  List<Map<String, dynamic>> _pendingPOs = [];
  bool _loading = true;
  bool _saving = false;
  String? _error;

  // Manual entry
  final _descCtrl = TextEditingController();
  final _amountCtrl = TextEditingController();
  final _paidToCtrl = TextEditingController();
  final _receiptCtrl = TextEditingController();
  final _poRefCtrl = TextEditingController();
  String _category = 'SUPPLIES';

  // PO mode
  Map<String, dynamic>? _selectedPO;
  bool _poMode = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _descCtrl.dispose();
    _amountCtrl.dispose();
    _paidToCtrl.dispose();
    _receiptCtrl.dispose();
    _poRefCtrl.dispose();
    super.dispose();
  }

  String? _openShiftId() {
    final shift = ref.read(cashierCurrentShiftProvider).valueOrNull;
    if (shift == null) return null;
    return _text(shift, ['id']);
  }

  Future<void> _load() async {
    final shiftId = _openShiftId();
    if (shiftId == null || shiftId.isEmpty) {
      setState(() { _loading = false; });
      return;
    }
    setState(() { _loading = true; _error = null; });
    try {
      final repo = ref.read(cashierRepositoryProvider);
      final results = await Future.wait([
        repo.getShiftExpenses(shiftId),
        repo.getPendingPOs(),
      ]);
      if (!mounted) return;
      setState(() {
        _expenses = results[0];
        _pendingPOs = results[1];
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() { _error = e.toString(); _loading = false; });
    }
  }

  Future<void> _recordExpense() async {
    final shiftId = _openShiftId();
    if (shiftId == null || shiftId.isEmpty) return;

    final String description;
    final num amount;
    final String? paidTo;
    final String? receipt;
    final String? poRef;

    if (_poMode && _selectedPO != null) {
      final po = _selectedPO!;
      description = 'PO #${_text(po, ['po_number', 'reference', 'id'])}: '
          '${_text(po, ['supplier_name', 'vendor_name', 'description'])}';
      amount = _num(po['total_amount'] ?? po['amount'] ?? 0);
      paidTo = _text(po, ['supplier_name', 'vendor_name']);
      receipt = _text(po, ['po_number', 'reference']);
      poRef = _text(po, ['po_number', 'reference', 'id']);
    } else {
      final raw = num.tryParse(_amountCtrl.text.trim());
      if (raw == null || raw <= 0 || _descCtrl.text.trim().isEmpty) {
        AppNotifier.show(context, 'Enter description and amount');
        return;
      }
      description = _descCtrl.text.trim();
      amount = raw;
      paidTo = _paidToCtrl.text.trim().isEmpty ? null : _paidToCtrl.text.trim();
      receipt =
          _receiptCtrl.text.trim().isEmpty ? null : _receiptCtrl.text.trim();
      poRef = _poRefCtrl.text.trim().isEmpty ? null : _poRefCtrl.text.trim();
    }

    setState(() => _saving = true);
    try {
      final repo = ref.read(cashierRepositoryProvider);
      await repo.recordShiftExpense(
        shiftId: shiftId,
        amount: amount,
        category: _category,
        description: description,
        paidToName: paidTo,
        receiptNumber: receipt,
        poReference: poRef,
      );
      _descCtrl.clear();
      _amountCtrl.clear();
      _paidToCtrl.clear();
      _receiptCtrl.clear();
      _poRefCtrl.clear();
      setState(() { _selectedPO = null; _saving = false; });
      await _load();
      if (mounted) AppNotifier.show(context, 'Expense recorded — cash reduced');
    } catch (e) {
      if (!mounted) return;
      setState(() => _saving = false);
      AppNotifier.show(context, 'Failed: ${apiErrorMessage(e)}');
    }
  }

  @override
  Widget build(BuildContext context) {
    final shift = ref.watch(cashierCurrentShiftProvider).valueOrNull;
    final openingFloat = _num(shift?['opening_float']);
    final cashSales = _num(shift?['total_cash_sales'] ?? shift?['total_cash']);
    final expensesTotal =
        _expenses.fold<num>(0, (s, e) => s + _num(e['amount']));
    final cashInDrawer = openingFloat + cashSales - expensesTotal;

    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // ── Header + cash position ──────────────────────────────────────
          Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Expenses & Petty Cash',
                        style: Theme.of(context).textTheme.headlineSmall),
                    const SizedBox(height: 4),
                    Text(
                      'All expenses are paid in CASH and reduce the cash drawer balance.',
                      style: const TextStyle(
                          color: AppColors.kTextSecondary, fontSize: 13),
                    ),
                  ],
                ),
              ),
              OutlinedButton.icon(
                onPressed: _loading ? null : _load,
                icon: const Icon(Icons.refresh, size: 16),
                label: const Text('Refresh'),
              ),
            ],
          ),
          const SizedBox(height: 16),
          // ── Cash position summary ───────────────────────────────────────
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Theme.of(context)
                  .colorScheme
                  .primaryContainer
                  .withValues(alpha: 0.3),
              borderRadius: BorderRadius.circular(10),
              border: Border.all(
                  color: Theme.of(context).colorScheme.primary.withValues(alpha: 0.3)),
            ),
            child: Wrap(
              spacing: 32,
              runSpacing: 8,
              children: [
                _statChip('Opening Float', _money(openingFloat)),
                _statChip('Cash Sales', _money(cashSales)),
                _statChip('Expenses Out', _money(expensesTotal),
                    accent: Colors.red.shade700),
                _statChip('Est. Cash in Drawer', _money(cashInDrawer),
                    accent: Theme.of(context).colorScheme.primary, bold: true),
              ],
            ),
          ),
          const SizedBox(height: 24),
          // ── Record new expense ──────────────────────────────────────────
          Text('Record Expense',
              style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 12),
          // Mode toggle
          Row(
            children: [
              FilterChip(
                avatar: const Icon(Icons.edit_note, size: 16),
                label: const Text('Manual entry'),
                selected: !_poMode,
                onSelected: (_) => setState(() {
                  _poMode = false;
                  _selectedPO = null;
                }),
              ),
              const SizedBox(width: 8),
              FilterChip(
                avatar: const Icon(Icons.description_outlined, size: 16),
                label: const Text('From PO'),
                selected: _poMode,
                onSelected: _pendingPOs.isEmpty
                    ? null
                    : (_) => setState(() => _poMode = true),
              ),
              if (_pendingPOs.isEmpty)
                const Padding(
                  padding: EdgeInsets.only(left: 8),
                  child: Text('(No approved POs)',
                      style: TextStyle(
                          color: AppColors.kTextSecondary, fontSize: 12)),
                ),
            ],
          ),
          const SizedBox(height: 12),
          if (_poMode) ...[
            // PO selector
            DropdownButtonFormField<Map<String, dynamic>>(
              value: _selectedPO,
              hint: const Text('Select an approved PO…'),
              isExpanded: true,
              items: _pendingPOs.map((po) {
                final num = _text(po, ['po_number', 'reference', 'id']);
                final supplier =
                    _text(po, ['supplier_name', 'vendor_name', 'description']);
                final amt = _num(po['total_amount'] ?? po['amount']);
                return DropdownMenuItem(
                  value: po,
                  child: Text('$num — $supplier  (${_money(amt)})'),
                );
              }).toList(),
              onChanged: (v) => setState(() => _selectedPO = v),
              decoration: const InputDecoration(labelText: 'Purchase Order'),
            ),
            if (_selectedPO != null) ...[
              const SizedBox(height: 8),
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: Colors.amber.shade50,
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: Colors.amber.shade200),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                        'PO #${_text(_selectedPO!, ['po_number', 'reference'])}',
                        style: const TextStyle(fontWeight: FontWeight.w700)),
                    Text(
                        'Supplier: ${_text(_selectedPO!, ['supplier_name', 'vendor_name'])}'),
                    Text(
                        'Amount: ${_money(_num(_selectedPO!['total_amount'] ?? _selectedPO!['amount']))}',
                        style: const TextStyle(fontWeight: FontWeight.w600)),
                  ],
                ),
              ),
            ],
          ] else ...[
            // Manual entry fields
            Wrap(
              spacing: 12,
              runSpacing: 12,
              children: [
                SizedBox(
                  width: 320,
                  child: TextField(
                    controller: _descCtrl,
                    decoration:
                        const InputDecoration(labelText: 'Description / Reason *'),
                  ),
                ),
                SizedBox(
                  width: 160,
                  child: TextField(
                    controller: _amountCtrl,
                    keyboardType: TextInputType.number,
                    decoration:
                        const InputDecoration(labelText: 'Amount (KES) *'),
                  ),
                ),
                SizedBox(
                  width: 200,
                  child: TextField(
                    controller: _paidToCtrl,
                    decoration: const InputDecoration(labelText: 'Paid to (name)'),
                  ),
                ),
                SizedBox(
                  width: 180,
                  child: TextField(
                    controller: _receiptCtrl,
                    decoration:
                        const InputDecoration(labelText: 'Receipt No.'),
                  ),
                ),
                SizedBox(
                  width: 220,
                  child: TextField(
                    controller: _poRefCtrl,
                    decoration: const InputDecoration(
                      labelText: 'PO Reference (optional)',
                      helperText: 'Tag a purchase order for traceability',
                    ),
                  ),
                ),
              ],
            ),
          ],
          const SizedBox(height: 12),
          // Category + submit row
          Wrap(
            spacing: 12,
            runSpacing: 12,
            crossAxisAlignment: WrapCrossAlignment.center,
            children: [
              SizedBox(
                width: 200,
                child: DropdownButtonFormField<String>(
                  value: _category,
                  items: _kExpenseCategories
                      .map((c) => DropdownMenuItem(value: c, child: Text(c)))
                      .toList(),
                  onChanged: (v) => setState(() => _category = v ?? _category),
                  decoration: const InputDecoration(labelText: 'Category'),
                ),
              ),
              ElevatedButton.icon(
                onPressed: _saving ? null : _recordExpense,
                icon: _saving
                    ? const SizedBox(
                        width: 16,
                        height: 16,
                        child: CircularProgressIndicator(strokeWidth: 2))
                    : const Icon(Icons.payments, size: 16),
                label: Text(_saving ? 'Recording…' : 'Record Cash Payment'),
                style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.red.shade700,
                    foregroundColor: Colors.white),
              ),
            ],
          ),
          const SizedBox(height: 32),
          // ── Recorded expenses list ──────────────────────────────────────
          Row(
            children: [
              Text('Recorded this Shift',
                  style: Theme.of(context).textTheme.titleMedium),
              const Spacer(),
              if (_expenses.isNotEmpty)
                Chip(
                  label: Text(
                      '${_expenses.length} entries  •  ${_money(expensesTotal)}',
                      style: const TextStyle(fontSize: 12)),
                ),
            ],
          ),
          const SizedBox(height: 8),
          if (_loading)
            const Center(
                child: Padding(
                    padding: EdgeInsets.all(32),
                    child: CircularProgressIndicator()))
          else if (_error != null)
            Text(_error!,
                style: const TextStyle(color: Colors.red))
          else if (_expenses.isEmpty)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 32),
              child: Center(
                  child: Text('No expenses recorded yet for this shift.',
                      style: TextStyle(color: AppColors.kTextSecondary))),
            )
          else
            Card(
              child: Column(
                children: [
                  const Padding(
                    padding: EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                    child: Row(
                      children: [
                        Expanded(
                            flex: 3,
                            child: Text('Description',
                                style: TextStyle(
                                    fontWeight: FontWeight.w600,
                                    fontSize: 12))),
                        Expanded(
                            child: Text('Category',
                                style: TextStyle(
                                    fontWeight: FontWeight.w600,
                                    fontSize: 12))),
                        Expanded(
                            child: Text('Paid To',
                                style: TextStyle(
                                    fontWeight: FontWeight.w600,
                                    fontSize: 12))),
                        SizedBox(
                            width: 100,
                            child: Text('Amount',
                                textAlign: TextAlign.right,
                                style: TextStyle(
                                    fontWeight: FontWeight.w600,
                                    fontSize: 12))),
                      ],
                    ),
                  ),
                  const Divider(height: 1),
                  ..._expenses.asMap().entries.map((e) {
                    final row = e.value;
                    return Container(
                      color: e.key.isEven ? null : Colors.grey.shade50,
                      padding: const EdgeInsets.symmetric(
                          horizontal: 16, vertical: 10),
                      child: Row(
                        children: [
                          Expanded(
                              flex: 3,
                              child: Text(
                                  _text(row, [
                                    'purpose_description',
                                    'description'
                                  ]),
                                  style: const TextStyle(fontSize: 13))),
                          Expanded(
                              child: Text(
                                  _text(row, [
                                    'purpose_category',
                                    'category'
                                  ]),
                                  style: const TextStyle(fontSize: 12))),
                          Expanded(
                              child: Text(
                                  _text(row, ['paid_to_name', 'paid_to']),
                                  style: const TextStyle(fontSize: 12))),
                          SizedBox(
                              width: 100,
                              child: Text(
                                _money(_num(row['amount'])),
                                textAlign: TextAlign.right,
                                style: const TextStyle(
                                    fontWeight: FontWeight.w600,
                                    fontSize: 13,
                                    color: Colors.red),
                              )),
                        ],
                      ),
                    );
                  }),
                  const Divider(height: 1),
                  Padding(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 16, vertical: 10),
                    child: Row(
                      children: [
                        const Expanded(
                            flex: 5,
                            child: Text('Total',
                                style:
                                    TextStyle(fontWeight: FontWeight.w700))),
                        SizedBox(
                          width: 100,
                          child: Text(
                            _money(expensesTotal),
                            textAlign: TextAlign.right,
                            style: TextStyle(
                                fontWeight: FontWeight.w700,
                                fontSize: 14,
                                color: Colors.red.shade700),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }

  Widget _statChip(String label, String value,
      {Color? accent, bool bold = false}) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label,
            style: const TextStyle(
                fontSize: 11, color: AppColors.kTextSecondary)),
        Text(value,
            style: TextStyle(
                fontSize: 16,
                fontWeight: bold ? FontWeight.w700 : FontWeight.w600,
                color: accent)),
      ],
    );
  }
}

// nests it (top-level for credit bills, `order`/`booking` for POS/hotel).
String _waiterName(Map<String, dynamic> bill) {
  final direct = _text(bill, ['waiter_name']);
  if (direct.isNotEmpty) return direct;
  for (final nestedKey in ['order', 'booking', 'invoice', 'bill']) {
    final nested = _asMap(bill[nestedKey]);
    final value = _text(nested, ['waiter_name']);
    if (value.isNotEmpty) return value;
  }
  return '';
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
