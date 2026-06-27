import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/master_dashboard_shell.dart';
import '../../../core/widgets/widgets.dart';
import '../../../services/print_service.dart';
import '../../pos/domain/models.dart';
import '../data/repository.dart';
import '../domain/models.dart';
import '../domain/providers.dart';

enum KitchenKdsSection { orders, voidRequests, history, analytics, notifications }

// Orders older than this with no clearing action (the backend's active-feed
// already drops anything marked served/completed) are hidden from the live
// Orders grid — they're stale tickets, not orders still being worked.
const int _kStaleOrderMinutes = 100;

class KDSScreen extends ConsumerStatefulWidget {
  const KDSScreen({super.key, this.initialSection = KitchenKdsSection.orders});

  final KitchenKdsSection initialSection;

  @override
  ConsumerState<KDSScreen> createState() => _KDSScreenState();
}

class _KDSScreenState extends ConsumerState<KDSScreen> {
  late KitchenKdsSection _section;
  late Future<_KitchenModuleSnapshot> _future;
  String _notificationStatus = 'unread';

  // Track printed order IDs to avoid duplicate printing
  final Set<String> _printedOrderIds = {};

  // Forces a rebuild every minute purely so the "stale order" cutoff below
  // (orders older than _kStaleOrderMinutes that were never cleared/served)
  // actually disappears close to real time, instead of only re-evaluating
  // whenever a Realtime event or manual refresh happens to fire.
  Timer? _staleSweepTimer;

  KitchenRepository get _repo => ref.read(kitchenRepositoryProvider);

  @override
  void initState() {
    super.initState();
    _section = widget.initialSection;
    _future = _load();
    // No polling timer — KdsNotifier uses Supabase Realtime to trigger
    // refreshes automatically. The FutureBuilder here handles history,
    // analytics, and notifications sections only.
    _staleSweepTimer = Timer.periodic(const Duration(minutes: 1), (_) {
      if (mounted) setState(() {});
    });
  }

  @override
  void didUpdateWidget(covariant KDSScreen oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.initialSection != widget.initialSection) {
      _section = widget.initialSection;
      _refresh();
    }
  }

  @override
  void dispose() {
    _staleSweepTimer?.cancel();
    super.dispose();
  }

  Future<_KitchenModuleSnapshot> _load() async {
    final results = await Future.wait<dynamic>([
      _repo.getOrders(),
      _repo.getHistory(limit: 150),
      _repo.getNotifications(
        status: _notificationStatus,
        category: 'restaurant_order',
      ),
    ]);
    final snapshot = _KitchenModuleSnapshot(
      activeOrders: (results[0] as List<KitchenOrder>),
      history: (results[1] as List<KitchenOrder>),
      notifications: (results[2] as List<Map<String, dynamic>>),
    );

    // Auto-print new captain orders when they arrive
    _autoPrintNewCaptainOrders(snapshot.activeOrders);

    return snapshot;
  }

  void _refresh() {
    setState(() {
      _future = _load();
    });
    // The Orders tab is driven by kdsOrdersProvider, not _future above — this
    // was previously a no-op for that tab (manual Refresh button, void-ack,
    // and other post-action refreshes never actually reloaded the live grid).
    ref.read(kdsOrdersProvider.notifier).refresh();
  }

  /// Automatically print captain order tickets as backup.
  /// Primary printing happens at backend (Python service) when order is created.
  /// This KDS auto-print serves as a backup in case backend printing fails,
  /// ensuring kitchen always gets the ticket even if there's a network/service issue.
  void _autoPrintNewCaptainOrders(List<KitchenOrder> orders) {
    try {
      for (final order in orders) {
        final printKey = order.kdsPrintKey;

        // Skip if this order or recalled batch was already printed by this KDS.
        if (_printedOrderIds.contains(printKey)) {
          continue;
        }

        // Skip if the server already has this order's current state marked
        // printed (by the backend's own attempt, or by another KDS/cashier
        // screen). This is what actually survives a logout/login — the
        // in-memory _printedOrderIds set above only protects this one
        // screen instance for as long as it stays mounted.
        if (order.captainOrderAlreadyPrinted) {
          _printedOrderIds.add(printKey);
          continue;
        }

        // Skip if order is voided or has void request (don't print cancelled orders)
        if (order.isVoided || order.hasPendingVoidRequest) {
          continue;
        }

        // Print freshly created tickets and recalled batches. Recalled orders
        // arrive with status=recalled and need a fresh kitchen ticket too.
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
        _printedOrderIds.add(printKey);
        _repo.markCaptainOrderPrinted(order.id);

        // Print captain order asynchronously (BACKUP - primary print at backend)
        _printCaptainOrder(order).then((_) {
          debugPrint(
              '✅ Captain order ${order.orderNumber} printed at KDS (backup)');
        }).catchError((error) {
          debugPrint(
              '⚠️ Failed to print captain order ${order.orderNumber} at KDS: $error');
        });
      }
    } catch (error) {
      debugPrint('❌ Error in KDS auto-print captain orders: $error');
    }
  }

  /// Print a captain order receipt for the kitchen
  Future<void> _printCaptainOrder(KitchenOrder order) async {
    final printService = PrintService();
    final printItems =
        order.hasRecalledItems ? order.recalledItems : order.items;
    final printTotal = printItems.fold<double>(
      0,
      (sum, item) => sum + (item.unitPrice * item.quantity),
    );
    final effectiveTotal = printTotal > 0 ? printTotal : order.total;

    // Convert kitchen order items to cart items for printing. The document
    // header already says "RECALLED CAPTAIN ORDER" when isRecall is true, so
    // there's no need to also prefix every single line with "RECALLED".
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

    // Create a minimal SaleResult for the captain order
    final saleResult = SaleResult(
      transactionId: order.id,
      receiptNumber: order.shortCode ?? order.orderNumber,
      total: effectiveTotal,
      paymentMethod: 'PENDING', // Captain orders are not yet paid
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
    );
  }

  @override
  Widget build(BuildContext context) {
    // Auto-print must react to every kdsOrdersProvider update (realtime push,
    // fallback poll, or manual refresh) — previously it only ran once inside
    // _load(), so an order arriving after the initial screen load via
    // Realtime would show up on the grid but never get a kitchen ticket.
    ref.listen<AsyncValue<List<KitchenOrder>>>(kdsOrdersProvider, (previous, next) {
      next.whenData(_autoPrintNewCaptainOrders);
    });
    return MasterDashboardShell<KitchenKdsSection>(
      title: 'Kitchen Display',
      subtitle: 'Restaurant orders only',
      initials: 'KD',
      breadcrumbRoot: 'Kitchen',
      searchHint: 'Search order, item, table...',
      palette: const ShellPalette(
        background: Color(0xFF1A1A2E),
        surface: Color(0xFF22223D),
        accent: AppColors.kAccent,
        onAccent: Color(0xFF1A1A2E),
        border: Color(0xFF34345A),
        text: Color(0xFFF5F6FA),
        mutedText: Color(0xFFAAAFC4),
      ),
      currentSection: _section,
      items: const [
        MasterNavItem(
          section: KitchenKdsSection.orders,
          label: 'Orders',
          icon: Icons.receipt_long_outlined,
          group: 'Kitchen Display',
        ),
        MasterNavItem(
          section: KitchenKdsSection.voidRequests,
          label: 'Void Requests',
          icon: Icons.remove_circle_outline,
          group: 'Kitchen Display',
        ),
        MasterNavItem(
          section: KitchenKdsSection.history,
          label: 'History',
          icon: Icons.history_outlined,
          group: 'Kitchen Display',
        ),
        MasterNavItem(
          section: KitchenKdsSection.analytics,
          label: 'Order Intelligence',
          icon: Icons.insights_outlined,
          group: 'Kitchen Display',
        ),
        MasterNavItem(
          section: KitchenKdsSection.notifications,
          label: 'Notifications',
          icon: Icons.notifications_active_outlined,
          group: 'Kitchen Display',
        ),
      ],
      onSectionSelected: (section) => setState(() => _section = section),
      child: _section == KitchenKdsSection.orders
          // Orders section is driven by kdsOrdersProvider (Realtime-backed)
          ? _buildOrdersSection()
          : _section == KitchenKdsSection.voidRequests
              // Self-contained: fetches/refreshes its own pending queues.
              ? const _KdsVoidRequestsSection()
              : FutureBuilder<_KitchenModuleSnapshot>(
                  key: ValueKey('${_section.name}-$_notificationStatus'),
                  future: _future,
                  builder: (context, snapshot) {
                    if (snapshot.connectionState == ConnectionState.waiting &&
                        !snapshot.hasData) {
                      return const Padding(
                        padding: EdgeInsets.all(24),
                        child: LoadingSkeleton(type: SkeletonType.list),
                      );
                    }
                    if (snapshot.hasError) {
                      return ErrorState(
                          message: '${snapshot.error}', onRetry: _refresh);
                    }
                    final data = snapshot.data ?? _KitchenModuleSnapshot.empty();
                    switch (_section) {
                      case KitchenKdsSection.orders:
                      case KitchenKdsSection.voidRequests:
                        // Unreachable — handled above
                        return const SizedBox.shrink();
                      case KitchenKdsSection.history:
                        return _history(data);
                      case KitchenKdsSection.analytics:
                        return _analytics(data);
                      case KitchenKdsSection.notifications:
                        return _notifications(data);
                    }
                  },
                ),
    );
  }

  /// Builds the live orders tab backed by kdsOrdersProvider (Supabase Realtime).
  Widget _buildOrdersSection() {
    final kdsAsync = ref.watch(kdsOrdersProvider);
    return kdsAsync.when(
      loading: () => const Padding(
        padding: EdgeInsets.all(24),
        child: LoadingSkeleton(type: SkeletonType.list),
      ),
      error: (err, _) =>
          ErrorState(message: '$err', onRetry: () => _refresh()),
      data: (activeOrders) => _orders(activeOrders),
    );
  }

  Widget _orders(List<KitchenOrder> rawActiveOrders) {
    // The backend's active-orders feed already excludes anything cleared
    // (kitchen_status served/completed) — so anything still in this list
    // that's been sitting for over _kStaleOrderMinutes was never cleared
    // and is just stale clutter on the wall display. Drop it rather than
    // letting it pile up forever. Uses effectiveCreatedAt (not elapsed/
    // createdAt) so a recalled order's clock resets to the recall time —
    // otherwise a bill recalled after 90 minutes would vanish again in 10.
    final activeOrders = rawActiveOrders
        .where((order) =>
            DateTime.now().difference(order.effectiveCreatedAt).inMinutes <=
            _kStaleOrderMinutes)
        .toList();
    // Newest orders first so chefs always see fresh tickets at the top.
    final orders = [...activeOrders]
      ..sort((a, b) => b.createdAt.compareTo(a.createdAt));
    final pending = activeOrders
        .where(
            (order) => order.status == 'pending' || order.status == 'confirmed')
        .length;
    final preparing =
        activeOrders.where((order) => order.status == 'preparing').length;
    final ready =
        activeOrders.where((order) => order.status == 'ready').length;
    final voidPending =
        activeOrders.where((order) => order.hasPendingVoidRequest).length;
    final voided = activeOrders.where((order) => order.isVoided).length;
    final avgWait = activeOrders.isEmpty
        ? 0
        : (activeOrders
                    .map((order) => order.elapsed.inMinutes)
                    .reduce((a, b) => a + b) /
                activeOrders.length)
            .round();

    return _Page(
      title: 'Restaurant Kitchen Orders',
      subtitle:
          'Live restaurant order queue from POS. Bar orders are excluded by using restaurant order tables only.',
      actions: [
        // Realtime live indicator dot
        const _RealtimeLiveDot(),
        if (voided > 0)
          FilledButton.icon(
            style: FilledButton.styleFrom(backgroundColor: AppColors.kError),
            onPressed: () => _acknowledgeAllVoids(orders),
            icon: const Icon(Icons.block, size: 18),
            label: Text('Clear All Voids ($voided)'),
          ),
        OutlinedButton.icon(
          onPressed: _refresh,
          icon: const Icon(Icons.refresh, size: 18),
          label: const Text('Refresh'),
        ),
      ],
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Wrap(
            spacing: 12,
            runSpacing: 12,
            children: [
              _StatTile('Pending', '$pending'),
              _StatTile('Preparing', '$preparing'),
              _StatTile('Ready', '$ready'),
              _StatTile('Void Pending', '$voidPending'),
              _StatTile('Voided', '$voided'),
              _StatTile('Avg Wait', '${avgWait}m'),
            ],
          ),
          const SizedBox(height: 24),
          if (orders.isEmpty)
            const EmptyState(message: 'No active restaurant orders.')
          else
            LayoutBuilder(
              builder: (context, constraints) {
                final width = constraints.maxWidth;
                // Big-screen friendly: keep each ticket a comfortable, readable
                // width (~360px) so a wall-mounted display fits several columns
                // without shrinking text.
                final columns = (width / 360).floor().clamp(1, 6);
                return GridView.builder(
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
                    crossAxisCount: columns,
                    crossAxisSpacing: 16,
                    mainAxisSpacing: 16,
                    mainAxisExtent: 460,
                  ),
                  itemCount: orders.length,
                  itemBuilder: (context, index) {
                    final order = orders[index];
                    // Index within the newest-first list — the first few are
                    // highlighted as freshly arrived.
                    return _OrderTicket(
                      order: order,
                      queuePosition: index + 1,
                      onItemReady: (item) => _run(
                        () => _repo.markItemReady(order.id, item.id),
                        successMessage: '${item.name} marked ready',
                      ),
                      onStart: () =>
                          _updateOrder(order.id, 'preparing', 'Order started'),
                      onReady: () => _updateOrder(
                          order.id, 'ready', 'Waiter notification sent'),
                      onServed: () => _updateOrder(
                          order.id, 'served', 'Order moved to history'),
                    );
                  },
                );
              },
            ),
        ],
      ),
    );
  }

  Widget _history(_KitchenModuleSnapshot data) {
    return _Page(
      title: 'Past Restaurant Orders',
      subtitle:
          'Served, delivered, paid and completed restaurant orders for the current branch.',
      actions: [
        OutlinedButton.icon(
          onPressed: _refresh,
          icon: const Icon(Icons.refresh, size: 18),
          label: const Text('Refresh'),
        ),
      ],
      child: _OrderList(
        orders: data.history,
        empty: 'No past restaurant orders found.',
      ),
    );
  }

  Widget _analytics(_KitchenModuleSnapshot data) {
    return _Page(
      title: 'Order Intelligence',
      subtitle:
          'Local machine-learning style order analysis from restaurant order names, quantities and timing.',
      actions: [
        OutlinedButton.icon(
          onPressed: _refresh,
          icon: const Icon(Icons.refresh, size: 18),
          label: const Text('Refresh'),
        ),
      ],
      child: _KitchenOrderIntelligenceContent(
        activeOrders: data.activeOrders,
        history: data.history,
      ),
    );
  }

  Widget _notifications(_KitchenModuleSnapshot data) {
    return _Page(
      title: 'Kitchen Notifications',
      subtitle:
          'Role and branch filtered notifications for this user and branch.',
      actions: [
        OutlinedButton.icon(
          onPressed: () => _run(() => _repo.markAllNotificationsRead()),
          icon: const Icon(Icons.done_all, size: 18),
          label: const Text('Mark All Read'),
        ),
      ],
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: {
              'unread': 'Unread',
              'read': 'Read',
              'ALL': 'All',
            }.entries.map((entry) {
              return ChoiceChip(
                label: Text(entry.value),
                selected: _notificationStatus == entry.key,
                onSelected: (_) {
                  _notificationStatus = entry.key;
                  _refresh();
                },
              );
            }).toList(),
          ),
          const SizedBox(height: 16),
          if (data.notifications.isEmpty)
            const EmptyState(message: 'No notifications found.')
          else
            Card(
              child: ListView.separated(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                itemCount: data.notifications.length,
                separatorBuilder: (_, __) => const Divider(height: 1),
                itemBuilder: (context, index) {
                  final item = data.notifications[index];
                  final read = item['is_read'] == true;
                  return ListTile(
                    leading: Icon(
                      read
                          ? Icons.notifications_none
                          : Icons.notifications_active,
                      color:
                          read ? AppColors.kTextSecondary : AppColors.kPrimary,
                    ),
                    title: Text(
                      '${item['title'] ?? 'Notification'}',
                      style: TextStyle(
                        fontWeight: read ? FontWeight.normal : FontWeight.bold,
                      ),
                    ),
                    subtitle: Text('${item['message'] ?? ''}'),
                    trailing: read
                        ? null
                        : IconButton(
                            tooltip: 'Mark read',
                            icon: const Icon(Icons.check, size: 18),
                            onPressed: () => _run(() =>
                                _repo.markNotificationRead('${item['id']}')),
                          ),
                  );
                },
              ),
            ),
        ],
      ),
    );
  }

  Future<void> _updateOrder(
    String orderId,
    String status,
    String successMessage,
  ) async {
    await _run(() => _repo.updateOrderStatus(orderId, status),
        successMessage: successMessage);
  }

  Future<void> _acknowledgeAllVoids(List<KitchenOrder> orders) async {
    final voids = orders.where((o) => o.isVoided).toList();
    if (voids.isEmpty) {
      AppNotifier.showSnackBar(
          context, const SnackBar(content: Text('No void orders to clear.')));
      return;
    }
    var ok = 0;
    var failed = 0;
    for (final order in voids) {
      try {
        await _repo.updateOrderStatus(order.id, 'served');
        ok++;
      } catch (_) {
        failed++;
      }
    }
    if (!mounted) return;
    AppNotifier.showSnackBar(
      context,
      SnackBar(
        content: Text(failed == 0
            ? 'Cleared $ok void order${ok == 1 ? '' : 's'} from the display.'
            : 'Cleared $ok void order${ok == 1 ? '' : 's'}, $failed failed.'),
      ),
    );
    _refresh();
  }

  Future<void> _run(
    Future<void> Function() action, {
    String successMessage = 'Updated',
  }) async {
    try {
      await action();
      if (!mounted) return;
      AppNotifier.showSnackBar(
          context, SnackBar(content: Text(successMessage)));
      _refresh();
    } catch (error) {
      if (!mounted) return;
      AppNotifier.showSnackBar(context, SnackBar(content: Text('$error')));
      _refresh();
    }
  }
}

/// Stage 1 of the waiter void chain: Kitchen acknowledges/declines before
/// the cashier or branch accountant ever see the request. Acknowledging
/// here applies no financial effect yet — it just signals the kitchen has
/// confirmed the item/bill can be pulled, and hands off to the cashier.
class _KdsVoidRequestsSection extends ConsumerStatefulWidget {
  const _KdsVoidRequestsSection();

  @override
  ConsumerState<_KdsVoidRequestsSection> createState() =>
      _KdsVoidRequestsSectionState();
}

class _KdsVoidRequestsSectionState
    extends ConsumerState<_KdsVoidRequestsSection> {
  late Future<List<List<Map<String, dynamic>>>> _future;
  final Set<String> _busyItemIds = {};
  final Set<String> _busyBillIds = {};

  KitchenRepository get _repo => ref.read(kitchenRepositoryProvider);

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  Future<List<List<Map<String, dynamic>>>> _load() => Future.wait([
        _repo.getPendingItemVoidsKitchen(),
        _repo.getPendingWholeBillVoidsKitchen(),
      ]);

  void _refresh() => setState(() => _future = _load());

  String _money(num value) => 'KES ${value.toStringAsFixed(0)}';

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<List<List<Map<String, dynamic>>>>(
      future: _future,
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting &&
            !snapshot.hasData) {
          return const Padding(
            padding: EdgeInsets.all(24),
            child: LoadingSkeleton(type: SkeletonType.list),
          );
        }
        if (snapshot.hasError) {
          return ErrorState(message: '${snapshot.error}', onRetry: _refresh);
        }
        final itemRequests = snapshot.data?[0] ?? const [];
        final billRequests = snapshot.data?[1] ?? const [];
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
                    onPressed: _refresh,
                    icon: const Icon(Icons.refresh, size: 16),
                    label: const Text('Refresh'),
                  ),
                ],
              ),
              const SizedBox(height: 6),
              const Text(
                'Waiters submit these when they void an item or a whole bill. '
                'Acknowledge to confirm it can be pulled and send it on to the '
                'cashier, or decline to keep it on the bill.',
                style: TextStyle(color: Color(0xFFAAAFC4), fontSize: 13),
              ),
              const SizedBox(height: 20),
              Text('Items', style: Theme.of(context).textTheme.titleMedium),
              const SizedBox(height: 8),
              if (itemRequests.isEmpty)
                const EmptyState(
                  icon: Icons.check_circle_outline,
                  message: 'No item void requests waiting on kitchen.',
                )
              else
                Column(
                    children: [for (final r in itemRequests) _itemCard(r)]),
              const SizedBox(height: 24),
              Text('Whole Bills',
                  style: Theme.of(context).textTheme.titleMedium),
              const SizedBox(height: 8),
              if (billRequests.isEmpty)
                const EmptyState(
                  icon: Icons.check_circle_outline,
                  message: 'No bill void requests waiting on kitchen.',
                )
              else
                Column(
                    children: [for (final r in billRequests) _billCard(r)]),
            ],
          ),
        );
      },
    );
  }

  Widget _itemCard(Map<String, dynamic> r) {
    final id = '${r['id'] ?? ''}';
    final busy = _busyItemIds.contains(id);
    final itemName = '${r['item_name'] ?? ''}';
    final qty = double.tryParse('${r['qty_to_void'] ?? 0}') ?? 0;
    final unitPrice = double.tryParse('${r['unit_price'] ?? 0}') ?? 0;
    final orderNumber = '${r['order_number'] ?? ''}';
    final requestedByName = '${r['requested_by_name'] ?? ''}';
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
                    '$itemName  ×${qty.toStringAsFixed(qty % 1 == 0 ? 0 : 1)}',
                    style: const TextStyle(
                        fontWeight: FontWeight.w700, fontSize: 15),
                  ),
                ),
                Text(_money(qty * unitPrice),
                    style: const TextStyle(
                        fontWeight: FontWeight.w700, fontSize: 15)),
              ],
            ),
            const SizedBox(height: 4),
            Text(
              [
                if (orderNumber.isNotEmpty) 'Order $orderNumber',
                if (requestedByName.isNotEmpty) 'by $requestedByName',
              ].join('  ·  '),
              style: const TextStyle(color: Color(0xFFAAAFC4), fontSize: 13),
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
                  onPressed:
                      busy || id.isEmpty ? null : () => _declineItem(id),
                  icon: const Icon(Icons.close, size: 16, color: Colors.red),
                  label: const Text('Decline',
                      style: TextStyle(color: Colors.red)),
                ),
                const SizedBox(width: 8),
                ElevatedButton.icon(
                  onPressed:
                      busy || id.isEmpty ? null : () => _acknowledgeItem(id),
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

  Widget _billCard(Map<String, dynamic> r) {
    final id = '${r['id'] ?? ''}';
    final busy = _busyBillIds.contains(id);
    final orderNumber = '${r['order_number'] ?? ''}';
    final totalAmount = double.tryParse('${r['total_amount'] ?? 0}') ?? 0;
    final requestedByName = '${r['requested_by_name'] ?? ''}';
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
            if (requestedByName.isNotEmpty)
              Text('by $requestedByName',
                  style:
                      const TextStyle(color: Color(0xFFAAAFC4), fontSize: 13)),
            if (reason.isNotEmpty) ...[
              const SizedBox(height: 6),
              Text('Reason: $reason', style: const TextStyle(fontSize: 13)),
            ],
            const SizedBox(height: 12),
            Row(
              mainAxisAlignment: MainAxisAlignment.end,
              children: [
                OutlinedButton.icon(
                  onPressed:
                      busy || id.isEmpty ? null : () => _declineBill(id),
                  icon: const Icon(Icons.close, size: 16, color: Colors.red),
                  label: const Text('Decline',
                      style: TextStyle(color: Colors.red)),
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
                  label: const Text('Acknowledge'),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _acknowledgeItem(String id) async {
    setState(() => _busyItemIds.add(id));
    try {
      await _repo.kitchenAcknowledgeItemVoid(id);
      if (!mounted) return;
      AppNotifier.showSnackBar(context,
          const SnackBar(content: Text('Acknowledged — sent to cashier.')));
      _refresh();
    } catch (error) {
      if (!mounted) return;
      AppNotifier.showSnackBar(context, SnackBar(content: Text('$error')));
    } finally {
      if (mounted) setState(() => _busyItemIds.remove(id));
    }
  }

  Future<void> _declineItem(String id) async {
    setState(() => _busyItemIds.add(id));
    try {
      await _repo.kitchenDeclineItemVoid(id);
      if (!mounted) return;
      AppNotifier.showSnackBar(context,
          const SnackBar(content: Text('Declined — item stays on the bill.')));
      _refresh();
    } catch (error) {
      if (!mounted) return;
      AppNotifier.showSnackBar(context, SnackBar(content: Text('$error')));
    } finally {
      if (mounted) setState(() => _busyItemIds.remove(id));
    }
  }

  Future<void> _acknowledgeBill(String id) async {
    setState(() => _busyBillIds.add(id));
    try {
      await _repo.kitchenAcknowledgeVoidRequest(id);
      if (!mounted) return;
      AppNotifier.showSnackBar(context,
          const SnackBar(content: Text('Acknowledged — sent to cashier.')));
      _refresh();
    } catch (error) {
      if (!mounted) return;
      AppNotifier.showSnackBar(context, SnackBar(content: Text('$error')));
    } finally {
      if (mounted) setState(() => _busyBillIds.remove(id));
    }
  }

  Future<void> _declineBill(String id) async {
    setState(() => _busyBillIds.add(id));
    try {
      await _repo.kitchenDeclineVoidRequest(id);
      if (!mounted) return;
      AppNotifier.showSnackBar(context,
          const SnackBar(content: Text('Declined — bill stays active.')));
      _refresh();
    } catch (error) {
      if (!mounted) return;
      AppNotifier.showSnackBar(context, SnackBar(content: Text('$error')));
    } finally {
      if (mounted) setState(() => _busyBillIds.remove(id));
    }
  }
}

class KitchenOrderIntelligencePanel extends ConsumerStatefulWidget {
  const KitchenOrderIntelligencePanel({super.key});

  @override
  ConsumerState<KitchenOrderIntelligencePanel> createState() =>
      _KitchenOrderIntelligencePanelState();
}

class _KitchenOrderIntelligencePanelState
    extends ConsumerState<KitchenOrderIntelligencePanel> {
  late Future<_KitchenOrderIntelligenceSnapshot> _future;

  KitchenRepository get _repo => ref.read(kitchenRepositoryProvider);

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  Future<_KitchenOrderIntelligenceSnapshot> _load() async {
    final results = await Future.wait<dynamic>([
      _repo.getOrders(),
      _repo.getHistory(limit: 150),
    ]);
    return _KitchenOrderIntelligenceSnapshot(
      activeOrders: results[0] as List<KitchenOrder>,
      history: results[1] as List<KitchenOrder>,
    );
  }

  void _refresh() {
    setState(() {
      _future = _load();
    });
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<_KitchenOrderIntelligenceSnapshot>(
      future: _future,
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting &&
            !snapshot.hasData) {
          return const Padding(
            padding: EdgeInsets.all(24),
            child: LoadingSkeleton(type: SkeletonType.list),
          );
        }
        if (snapshot.hasError) {
          return ErrorState(message: '${snapshot.error}', onRetry: _refresh);
        }
        final data = snapshot.data ?? const _KitchenOrderIntelligenceSnapshot();
        return _Page(
          title: 'Order Intelligence',
          subtitle:
              'Branch-specific kitchen demand, rush windows, and preparation pressure from restaurant POS orders.',
          actions: [
            OutlinedButton.icon(
              onPressed: _refresh,
              icon: const Icon(Icons.refresh, size: 18),
              label: const Text('Refresh'),
            ),
          ],
          child: _KitchenOrderIntelligenceContent(
            activeOrders: data.activeOrders,
            history: data.history,
          ),
        );
      },
    );
  }
}

class _KitchenOrderIntelligenceSnapshot {
  const _KitchenOrderIntelligenceSnapshot({
    this.activeOrders = const [],
    this.history = const [],
  });

  final List<KitchenOrder> activeOrders;
  final List<KitchenOrder> history;
}

class _KitchenModuleSnapshot {
  const _KitchenModuleSnapshot({
    required this.activeOrders,
    required this.history,
    required this.notifications,
  });

  factory _KitchenModuleSnapshot.empty() => const _KitchenModuleSnapshot(
        activeOrders: [],
        history: [],
        notifications: [],
      );

  final List<KitchenOrder> activeOrders;
  final List<KitchenOrder> history;
  final List<Map<String, dynamic>> notifications;
}

class _KitchenOrderIntelligenceContent extends StatelessWidget {
  const _KitchenOrderIntelligenceContent({
    required this.activeOrders,
    required this.history,
  });

  final List<KitchenOrder> activeOrders;
  final List<KitchenOrder> history;

  @override
  Widget build(BuildContext context) {
    final source = [...activeOrders, ...history];
    final analytics = _KitchenAnalytics.from(source);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Wrap(
          spacing: 12,
          runSpacing: 12,
          children: [
            _StatTile('Orders Analysed', '${source.length}'),
            _StatTile('Items Analysed', '${analytics.totalItems}'),
            _StatTile('Top Item', analytics.topItemName),
            _StatTile('Rush Window', analytics.rushWindow),
          ],
        ),
        const SizedBox(height: 24),
        _SectionCard(
          title: 'Most Ordered Items',
          child: analytics.topItems.isEmpty
              ? const EmptyState(message: 'No item trends yet.')
              : Column(
                  children: analytics.topItems
                      .map((item) => _MetricRow(
                            label: item.name,
                            value: '${item.quantity} ordered',
                            ratio: item.quantity / analytics.maxItemQuantity,
                          ))
                      .toList(),
                ),
        ),
        const SizedBox(height: 16),
        _SectionCard(
          title: 'Preparation Pressure',
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(analytics.insight,
                  style: const TextStyle(color: AppColors.kTextSecondary)),
              const SizedBox(height: 12),
              _MetricRow(
                label: 'Urgent active tickets',
                value: '${analytics.urgentOrders}',
                ratio:
                    source.isEmpty ? 0 : analytics.urgentOrders / source.length,
              ),
              _MetricRow(
                label: 'Ready waiting for waiter',
                value: '${analytics.readyOrders}',
                ratio: activeOrders.isEmpty
                    ? 0
                    : analytics.readyOrders / activeOrders.length,
              ),
            ],
          ),
        ),
      ],
    );
  }
}

/// Animated pulsing green dot that indicates Supabase Realtime is active.
/// Shown in the KDS orders action bar so kitchen staff can tell at a glance
/// whether the live feed is connected.
class _RealtimeLiveDot extends StatefulWidget {
  const _RealtimeLiveDot();

  @override
  State<_RealtimeLiveDot> createState() => _RealtimeLiveDotState();
}

class _RealtimeLiveDotState extends State<_RealtimeLiveDot>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _pulse;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 2),
    )..repeat(reverse: true);
    _pulse = Tween<double>(begin: 0.4, end: 1.0).animate(
      CurvedAnimation(parent: _controller, curve: Curves.easeInOut),
    );
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Tooltip(
      message: 'Supabase Realtime: Live',
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          AnimatedBuilder(
            animation: _pulse,
            builder: (_, __) => Container(
              width: 10,
              height: 10,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: const Color(0xFF22C55E).withOpacity(_pulse.value),
                boxShadow: [
                  BoxShadow(
                    color: const Color(0xFF22C55E).withOpacity(_pulse.value * 0.6),
                    blurRadius: 6,
                    spreadRadius: 2,
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(width: 6),
          const Text(
            'LIVE',
            style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w700,
              color: Color(0xFF22C55E),
              letterSpacing: 1.2,
            ),
          ),
        ],
      ),
    );
  }
}

class _Page extends StatelessWidget {

  const _Page({
    required this.title,
    required this.subtitle,
    required this.child,
    this.actions = const [],
  });

  final String title;
  final String subtitle;
  final Widget child;
  final List<Widget> actions;

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Wrap(
            spacing: 16,
            runSpacing: 12,
            alignment: WrapAlignment.spaceBetween,
            crossAxisAlignment: WrapCrossAlignment.center,
            children: [
              SizedBox(
                width: 560,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(title,
                        style: Theme.of(context).textTheme.headlineSmall),
                    const SizedBox(height: 4),
                    Text(subtitle,
                        style:
                            const TextStyle(color: AppColors.kTextSecondary)),
                  ],
                ),
              ),
              Wrap(spacing: 8, runSpacing: 8, children: actions),
            ],
          ),
          const SizedBox(height: 24),
          child,
        ],
      ),
    );
  }
}

class _OrderTicket extends StatelessWidget {
  const _OrderTicket({
    required this.order,
    required this.onItemReady,
    required this.onStart,
    required this.onReady,
    required this.onServed,
    this.queuePosition,
  });

  final KitchenOrder order;
  final int? queuePosition;
  final ValueChanged<KitchenOrderItem> onItemReady;
  final VoidCallback onStart;
  final VoidCallback onReady;
  final VoidCallback onServed;

  bool get _isNew => order.elapsed.inMinutes < 3;

  IconData get _typeIcon => order.orderType == 'room_service'
      ? Icons.hotel_outlined
      : order.orderType == 'takeaway'
          ? Icons.shopping_bag_outlined
          : Icons.table_restaurant_outlined;

  @override
  Widget build(BuildContext context) {
    final status = order.status.toLowerCase();
    final urgent = order.isUrgent;
    final isStopTicket = order.hasPendingVoidRequest || order.isVoided;
    final hasRecalledTicket = order.hasRecalledItems;
    final stopLabel = order.isVoided ? 'VOID' : 'VOID REQUESTED';
    final stopMessage = order.isVoided
        ? 'VOIDED - do not prepare. Acknowledge after kitchen has seen it.'
        : 'VOID REQUESTED - stop preparation until approval is complete.';
    final color = order.isVoided
        ? AppColors.kError
        : hasRecalledTicket
            ? Colors.deepOrange
            : status == 'ready'
                ? AppColors.kSuccess
                : status == 'preparing'
                    ? Colors.blue
                    : urgent
                        ? AppColors.kError
                        : AppColors.kWarning;
    final itemCount =
        order.items.fold<int>(0, (sum, item) => sum + item.quantity);
    return Card(
      clipBehavior: Clip.antiAlias,
      elevation: _isNew ? 6 : 2,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(14),
        side: isStopTicket
            ? const BorderSide(color: AppColors.kError, width: 3)
            : _isNew
                ? const BorderSide(color: AppColors.kAccent, width: 2.5)
                : const BorderSide(color: AppColors.kDivider),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // ── Header: big order number + timer (readable across the room) ──
          Container(
            color: color,
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(children: [
                        if (queuePosition != null) ...[
                          Container(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 8, vertical: 2),
                            decoration: BoxDecoration(
                              color: Colors.white.withValues(alpha: 0.25),
                              borderRadius: BorderRadius.circular(6),
                            ),
                            child: Text('#$queuePosition',
                                style: const TextStyle(
                                    color: Colors.white,
                                    fontWeight: FontWeight.w900,
                                    fontSize: 13)),
                          ),
                          const SizedBox(width: 8),
                        ],
                        if (_isNew)
                          Container(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 8, vertical: 2),
                            decoration: BoxDecoration(
                              color: Colors.white,
                              borderRadius: BorderRadius.circular(6),
                            ),
                            child: Text('NEW',
                                style: TextStyle(
                                    color: color,
                                    fontWeight: FontWeight.w900,
                                    fontSize: 12,
                                    letterSpacing: 1)),
                          ),
                        if (isStopTicket) ...[
                          if (_isNew) const SizedBox(width: 8),
                          Container(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 10, vertical: 3),
                            decoration: BoxDecoration(
                              color: Colors.white,
                              borderRadius: BorderRadius.circular(6),
                            ),
                            child: Text(
                              stopLabel,
                              style: const TextStyle(
                                color: AppColors.kError,
                                fontWeight: FontWeight.w900,
                                fontSize: 12,
                                letterSpacing: 1,
                              ),
                            ),
                          ),
                        ],
                        if (hasRecalledTicket) ...[
                          if (_isNew || isStopTicket) const SizedBox(width: 8),
                          Container(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 10, vertical: 3),
                            decoration: BoxDecoration(
                              color: Colors.white,
                              borderRadius: BorderRadius.circular(6),
                            ),
                            child: const Text(
                              'RECALLED BILL',
                              style: TextStyle(
                                color: Colors.deepOrange,
                                fontWeight: FontWeight.w900,
                                fontSize: 12,
                                letterSpacing: 1,
                              ),
                            ),
                          ),
                        ],
                      ]),
                      const SizedBox(height: 4),
                      Text(
                        'Order ${order.orderNumber}',
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          color: Colors.white,
                          fontWeight: FontWeight.w900,
                          fontSize: 24,
                          height: 1.1,
                          decoration:
                              isStopTicket ? TextDecoration.lineThrough : null,
                          decorationColor: Colors.white,
                          decorationThickness: 3,
                        ),
                      ),
                    ],
                  ),
                ),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Row(children: [
                      const Icon(Icons.timer_outlined,
                          color: Colors.white, size: 18),
                      const SizedBox(width: 4),
                      Text(
                        '${order.elapsed.inMinutes}m',
                        style: const TextStyle(
                          color: Colors.white,
                          fontWeight: FontWeight.w900,
                          fontSize: 22,
                        ),
                      ),
                    ]),
                    const SizedBox(height: 2),
                    Text('$itemCount item${itemCount == 1 ? '' : 's'}',
                        style: TextStyle(
                            color: Colors.white.withValues(alpha: 0.9),
                            fontWeight: FontWeight.w600,
                            fontSize: 12)),
                  ],
                ),
              ],
            ),
          ),
          if (isStopTicket)
            Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
              decoration: BoxDecoration(
                color: AppColors.kError.withValues(alpha: 0.08),
                border: Border(
                  bottom: BorderSide(
                    color: AppColors.kError.withValues(alpha: 0.22),
                  ),
                ),
              ),
              child: Row(
                children: [
                  const Icon(Icons.block, color: AppColors.kError, size: 20),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      stopMessage,
                      style: const TextStyle(
                        color: AppColors.kError,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          // ── Location / type / shortcode / waiter (large, scannable) ──
          Padding(
            padding: const EdgeInsets.fromLTRB(14, 12, 14, 8),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Icon(_typeIcon, size: 22, color: AppColors.kPrimary),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        order.locationLabel,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          fontWeight: FontWeight.w900,
                          fontSize: 19,
                          decoration:
                              isStopTicket ? TextDecoration.lineThrough : null,
                          decorationColor: AppColors.kError,
                          decorationThickness: 2.5,
                        ),
                      ),
                    ),
                    if (order.shortCode != null && order.shortCode!.isNotEmpty)
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 10, vertical: 5),
                        decoration: BoxDecoration(
                          color: AppColors.kPrimary,
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Text(
                          order.shortCode!,
                          style: const TextStyle(
                            color: Colors.white,
                            fontWeight: FontWeight.w900,
                            fontSize: 16,
                            letterSpacing: 1.5,
                          ),
                        ),
                      ),
                  ],
                ),
                const SizedBox(height: 8),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  crossAxisAlignment: WrapCrossAlignment.center,
                  children: [
                    _MetaPill(label: order.orderTypeLabel, icon: _typeIcon),
                    if ((order.waiterName ?? '').isNotEmpty)
                      _MetaPill(
                        label: 'Waiter: ${order.waiterName!}',
                        icon: Icons.person_outline,
                      ),
                    if ((order.customerName ?? '').isNotEmpty)
                      _MetaPill(
                        label: order.customerName!,
                        icon: Icons.badge_outlined,
                      ),
                    if (order.isCaptainOrder)
                      const _MetaPill(
                          label: 'Captain', icon: Icons.point_of_sale),
                    if (order.isExchangeOrder)
                      const _MetaPill(
                        label: 'Exchange',
                        icon: Icons.swap_horiz,
                        color: AppColors.kWarning,
                      ),
                    if (hasRecalledTicket)
                      const _MetaPill(
                        label: 'Recalled items',
                        icon: Icons.replay_outlined,
                      ),
                    if (order.paymentStatus != null &&
                        order.paymentStatus!.isNotEmpty)
                      _MetaPill(
                        label: order.paymentStatus!,
                        icon: Icons.payments_outlined,
                      ),
                    if (order.hasPendingVoidRequest)
                      const _MetaPill(
                        label: 'Void approval',
                        icon: Icons.block_outlined,
                      ),
                    if (order.isVoided)
                      const _MetaPill(label: 'Voided', icon: Icons.block),
                    _StatusPill(status: status),
                  ],
                ),
              ],
            ),
          ),
          const Divider(height: 1),
          Expanded(
            child: ListView.separated(
              padding: const EdgeInsets.all(12),
              itemCount: order.items.length,
              separatorBuilder: (_, __) => const SizedBox(height: 8),
              itemBuilder: (context, index) {
                final item = order.items[index];
                final isRecalledItem = item.isRecalledItem;
                // On a recalled ticket, items that aren't part of this recall
                // were already prepared before the recall happened — cross
                // them out so the kitchen knows to only cook the new lines.
                final isAlreadyMade = hasRecalledTicket && !isRecalledItem;
                final itemVoid = item.voidRequest;
                final isItemVoidActive = itemVoid?.isActive ?? false;
                return Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: isStopTicket
                        ? AppColors.kError.withValues(alpha: 0.04)
                        : isRecalledItem
                            ? Colors.deepOrange.withValues(alpha: 0.08)
                            : AppColors.kSurface,
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(
                      color: isStopTicket
                          ? AppColors.kError.withValues(alpha: 0.24)
                          : isRecalledItem
                              ? Colors.deepOrange.withValues(alpha: 0.35)
                              : AppColors.kDivider,
                    ),
                  ),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Container(
                        constraints: const BoxConstraints(minWidth: 40),
                        padding: const EdgeInsets.symmetric(
                            horizontal: 8, vertical: 6),
                        decoration: BoxDecoration(
                          color: isRecalledItem
                              ? Colors.deepOrange
                              : AppColors.kPrimary,
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Text(
                          '${item.quantity}',
                          textAlign: TextAlign.center,
                          style: const TextStyle(
                            fontWeight: FontWeight.w900,
                            color: Colors.white,
                            fontSize: 18,
                          ),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(item.name,
                                style: TextStyle(
                                  fontWeight: FontWeight.w800,
                                  fontSize: 16,
                                  color: isAlreadyMade
                                      ? AppColors.kTextSecondary
                                      : null,
                                  decoration: (isStopTicket || isAlreadyMade)
                                      ? TextDecoration.lineThrough
                                      : null,
                                  decorationColor: isStopTicket
                                      ? AppColors.kError
                                      : AppColors.kTextSecondary,
                                  decorationThickness: 2.5,
                                )),
                            if (isAlreadyMade)
                              const Padding(
                                padding: EdgeInsets.only(top: 3),
                                child: Text(
                                  'ALREADY MADE',
                                  style: TextStyle(
                                    color: AppColors.kTextSecondary,
                                    fontSize: 12,
                                    fontWeight: FontWeight.w900,
                                    letterSpacing: 0.6,
                                  ),
                                ),
                              ),
                            if (isRecalledItem)
                              const Padding(
                                padding: EdgeInsets.only(top: 3),
                                child: Text(
                                  'RECALLED ITEM',
                                  style: TextStyle(
                                    color: Colors.deepOrange,
                                    fontSize: 12,
                                    fontWeight: FontWeight.w900,
                                    letterSpacing: 0.6,
                                  ),
                                ),
                              ),
                            if (item.notes != null && item.notes!.isNotEmpty)
                              Text(
                                'Note: ${item.notes}',
                                style: const TextStyle(
                                  color: AppColors.kWarning,
                                  fontSize: 13,
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                            if (itemVoid != null)
                              Padding(
                                padding: const EdgeInsets.only(top: 4),
                                child: Container(
                                  padding: const EdgeInsets.symmetric(
                                      horizontal: 8, vertical: 3),
                                  decoration: BoxDecoration(
                                    color: _voidChipColor(itemVoid.status)
                                        .withValues(alpha: 0.12),
                                    borderRadius: BorderRadius.circular(999),
                                    border: Border.all(
                                      color: _voidChipColor(itemVoid.status)
                                          .withValues(alpha: 0.4),
                                    ),
                                  ),
                                  child: Text(
                                    itemVoid.reason == null ||
                                            itemVoid.reason!.isEmpty
                                        ? itemVoid.label
                                        : '${itemVoid.label} • ${itemVoid.reason}',
                                    style: TextStyle(
                                      color: _voidChipColor(itemVoid.status),
                                      fontSize: 11,
                                      fontWeight: FontWeight.w800,
                                      letterSpacing: 0.4,
                                    ),
                                  ),
                                ),
                              ),
                          ],
                        ),
                      ),
                      IconButton(
                        tooltip:
                            item.isReady ? 'Item ready' : 'Mark item ready',
                        onPressed: item.isReady ||
                                order.hasPendingVoidRequest ||
                                order.isVoided ||
                                isItemVoidActive
                            ? null
                            : () => onItemReady(item),
                        icon: Icon(
                          item.isReady
                              ? Icons.check_circle
                              : Icons.radio_button_unchecked,
                          color: item.isReady
                              ? AppColors.kSuccess
                              : AppColors.kTextSecondary,
                        ),
                      ),
                    ],
                  ),
                );
              },
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(12),
            child: _ticketAction(status),
          ),
        ],
      ),
    );
  }

  Widget _ticketAction(String status) {
    if (order.hasPendingVoidRequest) {
      return Container(
        width: double.infinity,
        padding: const EdgeInsets.all(10),
        decoration: BoxDecoration(
          color: AppColors.kError.withValues(alpha: 0.08),
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: AppColors.kError.withValues(alpha: 0.18)),
        ),
        child: const Text(
          'Void approval pending. Stop preparation.',
          textAlign: TextAlign.center,
          style: TextStyle(
            color: AppColors.kError,
            fontWeight: FontWeight.w800,
          ),
        ),
      );
    }
    if (order.isVoided) {
      return OutlinedButton.icon(
        onPressed: onServed,
        icon: const Icon(Icons.visibility_off_outlined, size: 18),
        label: const Text('Acknowledge Void'),
      );
    }
    if (status == 'pending' || status == 'confirmed') {
      return FilledButton.icon(
        onPressed: onStart,
        icon: const Icon(Icons.play_arrow, size: 18),
        label: const Text('Start Cooking'),
      );
    }
    if (status == 'preparing') {
      return FilledButton.icon(
        onPressed: onReady,
        icon: const Icon(Icons.notifications_active_outlined, size: 18),
        label: const Text('Ready to Serve'),
      );
    }
    if (status == 'ready') {
      return OutlinedButton.icon(
        onPressed: onServed,
        icon: const Icon(Icons.room_service_outlined, size: 18),
        label: const Text('Served'),
      );
    }
    if (status == 'recalled') {
      return OutlinedButton.icon(
        onPressed: onServed,
        icon: const Icon(Icons.room_service_outlined, size: 18),
        label: const Text('Served'),
      );
    }
    return const SizedBox.shrink();
  }

  Color _voidChipColor(String status) {
    switch (status) {
      case 'pending':
        return AppColors.kWarning;
      case 'void_acknowledged':
        return Colors.orange;
      case 'approved':
        return AppColors.kSuccess;
      case 'rejected':
        return AppColors.kError;
      case 'void_cashier_declined':
        return Colors.grey;
      default:
        return AppColors.kTextSecondary;
    }
  }
}

class _OrderList extends StatelessWidget {
  const _OrderList({required this.orders, required this.empty});

  final List<KitchenOrder> orders;
  final String empty;

  @override
  Widget build(BuildContext context) {
    if (orders.isEmpty) return EmptyState(message: empty);
    return Card(
      child: ListView.separated(
        shrinkWrap: true,
        physics: const NeverScrollableScrollPhysics(),
        itemCount: orders.length,
        separatorBuilder: (_, __) => const Divider(height: 1),
        itemBuilder: (context, index) {
          final order = orders[index];
          final isStopTicket = order.hasPendingVoidRequest || order.isVoided;
          return ListTile(
            leading: Icon(
              isStopTicket ? Icons.block : Icons.receipt_long_outlined,
              color: isStopTicket ? AppColors.kError : null,
            ),
            title: Text(
              '#${order.orderNumber} • ${order.locationLabel} • ${order.orderTypeLabel}',
              style: TextStyle(
                decoration: isStopTicket ? TextDecoration.lineThrough : null,
                decorationColor: AppColors.kError,
                decorationThickness: 2.5,
              ),
            ),
            subtitle: Text(
              '${(order.waiterName ?? '').isEmpty ? 'Waiter not assigned' : 'Waiter: ${order.waiterName}'}\n'
              '${order.items.map((item) => '${item.quantity}x ${item.name}').join(', ')}\n${order.createdAt}',
              maxLines: 3,
              overflow: TextOverflow.ellipsis,
            ),
            trailing: _StatusPill(status: order.status),
          );
        },
      ),
    );
  }
}

class _MetaPill extends StatelessWidget {
  const _MetaPill({required this.label, required this.icon, this.color});

  final String label;
  final IconData icon;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    final pillColor = color ?? AppColors.kPrimary;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: pillColor.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: pillColor.withValues(alpha: 0.18)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 12, color: pillColor),
          const SizedBox(width: 4),
          Text(
            label.toUpperCase(),
            style: TextStyle(
              color: pillColor,
              fontSize: 10,
              fontWeight: FontWeight.w800,
            ),
          ),
        ],
      ),
    );
  }
}

class _StatusPill extends StatelessWidget {
  const _StatusPill({required this.status});

  final String status;

  @override
  Widget build(BuildContext context) {
    final normalized = status.toLowerCase();
    final isVoidStatus = normalized == 'void_requested' ||
        normalized == 'cancelled' ||
        normalized == 'voided';
    final color = isVoidStatus
        ? AppColors.kError
        : normalized == 'ready' ||
                normalized == 'served' ||
                normalized == 'delivered' ||
                normalized == 'completed'
            ? AppColors.kSuccess
            : normalized == 'preparing'
                ? Colors.blue
                : AppColors.kWarning;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Text(
        normalized.toUpperCase(),
        style: TextStyle(
          color: color,
          fontSize: 10,
          fontWeight: FontWeight.w800,
        ),
      ),
    );
  }
}

class _StatTile extends StatelessWidget {
  const _StatTile(this.label, this.value);

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 180,
      child: Card(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(value,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                      fontSize: 21, fontWeight: FontWeight.bold)),
              const SizedBox(height: 4),
              Text(label,
                  style: const TextStyle(
                      color: AppColors.kTextSecondary, fontSize: 12)),
            ],
          ),
        ),
      ),
    );
  }
}

class _SectionCard extends StatelessWidget {
  const _SectionCard({required this.title, required this.child});

  final String title;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(title, style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 12),
            child,
          ],
        ),
      ),
    );
  }
}

class _MetricRow extends StatelessWidget {
  const _MetricRow({
    required this.label,
    required this.value,
    required this.ratio,
  });

  final String label;
  final String value;
  final double ratio;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(
        children: [
          SizedBox(width: 220, child: Text(label)),
          Expanded(
            child: ClipRRect(
              borderRadius: BorderRadius.circular(20),
              child: LinearProgressIndicator(
                value: ratio.clamp(0, 1),
                minHeight: 9,
                backgroundColor: AppColors.kDivider,
              ),
            ),
          ),
          const SizedBox(width: 12),
          SizedBox(
            width: 110,
            child: Text(value, textAlign: TextAlign.end),
          ),
        ],
      ),
    );
  }
}

class _KitchenAnalytics {
  const _KitchenAnalytics({
    required this.topItems,
    required this.totalItems,
    required this.topItemName,
    required this.maxItemQuantity,
    required this.rushWindow,
    required this.urgentOrders,
    required this.readyOrders,
    required this.insight,
  });

  factory _KitchenAnalytics.from(List<KitchenOrder> orders) {
    final itemTotals = <String, int>{};
    final hourTotals = <int, int>{};
    var urgent = 0;
    var ready = 0;

    for (final order in orders) {
      hourTotals[order.createdAt.hour] =
          (hourTotals[order.createdAt.hour] ?? 0) + 1;
      if (order.isUrgent) urgent++;
      if (order.status.toLowerCase() == 'ready') ready++;
      for (final item in order.items) {
        itemTotals[item.name] = (itemTotals[item.name] ?? 0) + item.quantity;
      }
    }

    final topItems = itemTotals.entries
        .map((entry) => _TopItem(entry.key, entry.value))
        .toList()
      ..sort((a, b) => b.quantity.compareTo(a.quantity));
    final topHours = hourTotals.entries.toList()
      ..sort((a, b) => b.value.compareTo(a.value));
    final topHour = topHours.isEmpty ? null : topHours.first.key;
    final topItem = topItems.isEmpty ? null : topItems.first;

    return _KitchenAnalytics(
      topItems: topItems.take(8).toList(),
      totalItems: itemTotals.values.fold(0, (sum, qty) => sum + qty),
      topItemName: topItem?.name ?? '-',
      maxItemQuantity: topItem == null ? 1 : topItem.quantity.toDouble(),
      rushWindow: topHour == null
          ? '-'
          : '${topHour.toString().padLeft(2, '0')}:00-${((topHour + 1) % 24).toString().padLeft(2, '0')}:00',
      urgentOrders: urgent,
      readyOrders: ready,
      insight: topItem == null
          ? 'Once orders flow through the restaurant POS, this panel will identify demand patterns from item names, quantities and order timing.'
          : '${topItem.name} is currently the strongest demand signal. Prep planning should prioritize mise en place before the $topHour:00 rush window.',
    );
  }

  final List<_TopItem> topItems;
  final int totalItems;
  final String topItemName;
  final double maxItemQuantity;
  final String rushWindow;
  final int urgentOrders;
  final int readyOrders;
  final String insight;
}

class _TopItem {
  const _TopItem(this.name, this.quantity);
  final String name;
  final int quantity;
}
