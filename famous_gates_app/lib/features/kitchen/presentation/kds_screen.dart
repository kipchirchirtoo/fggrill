import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/master_dashboard_shell.dart';
import '../../../core/widgets/widgets.dart';
import '../data/repository.dart';
import '../domain/display_scope.dart';
import '../domain/models.dart';
import '../domain/providers.dart';

enum KitchenKdsSection { orders, voidRequests, history, analytics, notifications, settings }

// Africa/Nairobi is a fixed UTC+3 offset (no DST), so a printed-time label
// always shows Kenyan local time regardless of the device clock's timezone.
String _kdsKenyaTime(DateTime value) {
  final k = value.toUtc().add(const Duration(hours: 3));
  final h12 = k.hour % 12 == 0 ? 12 : k.hour % 12;
  final ampm = k.hour < 12 ? 'AM' : 'PM';
  return '$h12:${k.minute.toString().padLeft(2, '0')} $ampm';
}

// Orders older than this with no clearing action (the backend's active-feed
// already drops anything marked served/completed) are hidden from the live
// Orders grid — they're stale tickets, not orders still being worked.
const int _kStaleOrderMinutes = 100;

class KDSScreen extends ConsumerStatefulWidget {
  const KDSScreen({
    super.key,
    this.initialSection = KitchenKdsSection.orders,
    this.scope = KitchenDisplayScope.restaurant,
  });

  final KitchenKdsSection initialSection;
  final KitchenDisplayScope scope;

  @override
  ConsumerState<KDSScreen> createState() => _KDSScreenState();
}

class _KDSScreenState extends ConsumerState<KDSScreen> {
  late KitchenKdsSection _section;
  late Future<_KitchenModuleSnapshot> _future;
  String _notificationStatus = 'unread';

  // Live-orders filters (mockup top tabs + bottom table strip).
  // _statusFilter: all | new | preparing | ready | recalled | void_pending
  String _statusFilter = 'all';
  String? _tableFilter; // null = all tables

  // Forces a rebuild every minute purely so the "stale order" cutoff below
  // (orders older than _kStaleOrderMinutes that were never cleared/served)
  // actually disappears close to real time, instead of only re-evaluating
  // whenever a Realtime event or manual refresh happens to fire.
  Timer? _staleSweepTimer;

  KitchenRepository get _repo => ref.read(kitchenRepositoryProvider);

  StateNotifierProvider<KdsNotifier, AsyncValue<List<KitchenOrder>>>
      get _ordersProvider => widget.scope == KitchenDisplayScope.chomaZone
          ? chomaZoneKdsOrdersProvider
          : kdsOrdersProvider;

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
    // Do NOT fetch active orders here — the live orders grid is driven
    // exclusively by kdsOrdersProvider (Realtime-backed). Fetching a
    // second copy via _repo.getOrders() would pollute _printedOrderIds
    // before kdsOrdersProvider fires its first data event, causing
    // ref.listen's auto-print to silently skip every order that arrived
    // on initial load (they'd already be in the dedup set).
    final results = await Future.wait<dynamic>([
      _repo.getHistory(limit: 150, outletScope: widget.scope),
      _repo.getNotifications(
        status: _notificationStatus,
        category: 'restaurant_order',
      ),
    ]);
    return _KitchenModuleSnapshot(
      activeOrders: const [],
      history: (results[0] as List<KitchenOrder>),
      notifications: (results[1] as List<Map<String, dynamic>>),
    );
  }

  void _refresh() {
    setState(() {
      _future = _load();
    });
    // The Orders tab is driven by kdsOrdersProvider, not _future above — this
    // was previously a no-op for that tab (manual Refresh button, void-ack,
    // and other post-action refreshes never actually reloaded the live grid).
    ref.read(_ordersProvider.notifier).refresh();
  }

  String _routeForSection(
    KitchenDisplayScope scope,
    KitchenKdsSection section,
  ) {
    final base = scope.routeBase;
    switch (section) {
      case KitchenKdsSection.orders:
        return base;
      case KitchenKdsSection.voidRequests:
        return '$base/void-requests';
      case KitchenKdsSection.history:
        return '$base/history';
      case KitchenKdsSection.analytics:
        return '$base/analytics';
      case KitchenKdsSection.notifications:
        return '$base/notifications';
      case KitchenKdsSection.settings:
        // No dedicated route — Settings is an in-app section; keep scope
        // switching anchored to the orders base to avoid a 404.
        return base;
    }
  }

  Widget _scopeSwitcher() {
    final current = widget.scope;
    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: KitchenDisplayScope.values.map((scope) {
        final selected = scope == current;
        return ChoiceChip(
          label: Text(
            scope == KitchenDisplayScope.chomaZone
                ? 'Choma Zone'
                : 'Restaurant',
          ),
          selected: selected,
          onSelected: selected
              ? null
              : (_) => context.go(_routeForSection(scope, _section)),
        );
      }).toList(),
    );
  }

  @override
  Widget build(BuildContext context) {
    return MasterDashboardShell<KitchenKdsSection>(
      initialSidebarCollapsed: true,
      enableHorizontalAccess: false,
      title: widget.scope.shellTitle,
      subtitle: widget.scope.shellSubtitle,
      initials: widget.scope.initials,
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
          section: KitchenKdsSection.voidRequests,
          label: 'Void',
          icon: Icons.remove_circle_outline,
          group: 'Kitchen Display',
        ),
        MasterNavItem(
          section: KitchenKdsSection.notifications,
          label: 'Alerts',
          icon: Icons.notifications_active_outlined,
          group: 'Kitchen Display',
        ),
        MasterNavItem(
          section: KitchenKdsSection.settings,
          label: 'Settings',
          icon: Icons.settings_outlined,
          group: 'Kitchen Display',
        ),
      ],
      onSectionSelected: (section) => setState(() => _section = section),
      child: _section == KitchenKdsSection.orders
          // Orders section is driven by kdsOrdersProvider (Realtime-backed)
          ? _buildOrdersSection()
          : _section == KitchenKdsSection.voidRequests
              // Self-contained: fetches/refreshes its own pending queues.
              ? _KdsVoidRequestsSection(scope: widget.scope)
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
                      case KitchenKdsSection.settings:
                        return _settings(data);
                    }
                  },
                ),
    );
  }

  /// Builds the live orders tab backed by kdsOrdersProvider (Supabase Realtime).
  Widget _buildOrdersSection() {
    final kdsAsync = ref.watch(_ordersProvider);
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

  Widget _settings(_KitchenModuleSnapshot data) {
    return _Page(
      title: 'Settings',
      subtitle: 'Kitchen display preferences',
      actions: [_scopeSwitcher(), const _RealtimeLiveDot()],
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _SectionCard(
            title: 'Display scope',
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                    'Choose which kitchen this display shows live orders for.'),
                const SizedBox(height: 12),
                _scopeSwitcher(),
              ],
            ),
          ),
          const SizedBox(height: 16),
          _SectionCard(
            title: 'Live orders',
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                    'Orders update in real time. Force a reload, or open Order '
                    'Intelligence for prep-time and volume analytics.'),
                const SizedBox(height: 12),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    OutlinedButton.icon(
                      onPressed: _refresh,
                      icon: const Icon(Icons.refresh, size: 18),
                      label: const Text('Refresh now'),
                    ),
                    OutlinedButton.icon(
                      onPressed: () => setState(
                          () => _section = KitchenKdsSection.analytics),
                      icon: const Icon(Icons.insights_outlined, size: 18),
                      label: const Text('Order Intelligence'),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  // Whether an order matches the active top status-filter tab.
  bool _matchesStatus(KitchenOrder o, String filter) {
    switch (filter) {
      case 'new':
        return o.status == 'pending' || o.status == 'confirmed';
      case 'preparing':
        return o.status == 'preparing';
      case 'ready':
        return o.status == 'ready';
      case 'recalled':
        return o.hasRecalledItems;
      case 'void_pending':
        return o.hasPendingVoidRequest;
      default:
        return true; // 'all'
    }
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
            DateTime.now().difference(order.createdAt).inMinutes <=
            _kStaleOrderMinutes)
        .toList();
    // Oldest orders first (FIFO): the longest-waiting ticket sits at the front
    // and freshly-arrived orders queue behind it, so the kitchen works tickets
    // in the order they came in.
    final orders = [...activeOrders]
      ..sort((a, b) => a.createdAt.compareTo(b.createdAt));
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
    final recalled = activeOrders.where((o) => o.hasRecalledItems).length;
    // Orders visible after applying the top status filter + bottom table filter.
    final visibleOrders = orders
        .where((o) =>
            _matchesStatus(o, _statusFilter) &&
            (_tableFilter == null || '${o.tableNumber ?? ''}' == _tableFilter))
        .toList();
    // Distinct tables among the status-filtered orders → bottom table strip.
    final tableStrip = <MapEntry<String, String>>[];
    final seenTables = <String>{};
    for (final o in orders.where((o) => _matchesStatus(o, _statusFilter))) {
      final t = '${o.tableNumber ?? ''}'.trim();
      if (t.isEmpty || seenTables.contains(t)) continue;
      seenTables.add(t);
      tableStrip.add(MapEntry(
          t, (o.shortCode?.isNotEmpty ?? false) ? o.shortCode! : o.orderNumber));
    }

    return _Page(
      title: widget.scope.ordersTitle,
      subtitle: widget.scope.ordersSubtitle,
      actions: [
        _scopeSwitcher(),
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
          // ── Top status filter tabs (ALL / NEW / PREPARING / READY / …) ──
          _KdsStatusTabs(
            active: _statusFilter,
            counts: {
              'all': orders.length,
              'new': pending,
              'preparing': preparing,
              'ready': ready,
              'recalled': recalled,
              'void_pending': voidPending,
            },
            onSelected: (s) => setState(() => _statusFilter = s),
          ),
          const SizedBox(height: 16),
          // ── Orders grid (filtered) ──────────────────────────────────
          if (visibleOrders.isEmpty)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 48),
              child: EmptyState(
                message: _statusFilter == 'all' && _tableFilter == null
                    ? widget.scope.emptyOrdersMessage
                    : 'No orders match this filter.',
              ),
            )
          else
            LayoutBuilder(
              builder: (context, constraints) {
                final width = constraints.maxWidth;
                // 3 tickets per row on a wall-mounted display (wide, readable
                // cards). Degrade to 2 or 1 only on genuinely narrow screens so
                // cards never get cut off.
                final columns =
                    width >= 1080 ? 3 : (width / 360).floor().clamp(1, 3);
                return GridView.builder(
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
                    crossAxisCount: columns,
                    crossAxisSpacing: 16,
                    mainAxisSpacing: 16,
                    mainAxisExtent: 460,
                  ),
                  itemCount: visibleOrders.length,
                  itemBuilder: (context, index) {
                    final order = visibleOrders[index];
                    // Oldest-first: queue position 1 is the longest-waiting.
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
          // ── Bottom table strip (T1 #code · T2 #code · …) ─────────────
          if (tableStrip.isNotEmpty) ...[
            const SizedBox(height: 20),
            _KdsTableStrip(
              tables: tableStrip,
              active: _tableFilter,
              onSelected: (t) => setState(
                  () => _tableFilter = (t == _tableFilter) ? null : t),
            ),
          ],
        ],
      ),
    );
  }

  Widget _history(_KitchenModuleSnapshot data) {
    return _Page(
      title: widget.scope.historyTitle,
      subtitle: widget.scope.historySubtitle,
      actions: [
        _scopeSwitcher(),
        OutlinedButton.icon(
          onPressed: _refresh,
          icon: const Icon(Icons.refresh, size: 18),
          label: const Text('Refresh'),
        ),
      ],
      child: _OrderList(
        orders: data.history,
        empty: widget.scope.emptyHistoryMessage,
      ),
    );
  }

  Widget _analytics(_KitchenModuleSnapshot data) {
    return _Page(
      title: 'Order Intelligence',
      subtitle: widget.scope.analyticsSubtitle,
      actions: [
        _scopeSwitcher(),
        OutlinedButton.icon(
          onPressed: _refresh,
          icon: const Icon(Icons.refresh, size: 18),
          label: const Text('Refresh'),
        ),
      ],
      child: _KitchenOrderIntelligenceContent(
        activeOrders: data.activeOrders,
        history: data.history,
        scope: widget.scope,
      ),
    );
  }

  Widget _notifications(_KitchenModuleSnapshot data) {
    return _Page(
      title: 'Kitchen Notifications',
      subtitle:
          'Role and branch filtered notifications for this user and branch.',
      actions: [
        _scopeSwitcher(),
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
  const _KdsVoidRequestsSection({required this.scope});

  final KitchenDisplayScope scope;

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
        _repo.getPendingItemVoidsKitchen(outletScope: widget.scope),
        _repo.getPendingWholeBillVoidsKitchen(outletScope: widget.scope),
      ]);

  void _refresh() => setState(() => _future = _load());

  String _money(num value) => 'KES ${value.toStringAsFixed(0)}';

  String _routeForScope(KitchenDisplayScope scope) {
    switch (scope) {
      case KitchenDisplayScope.restaurant:
        return '/kitchen/void-requests';
      case KitchenDisplayScope.chomaZone:
        return '/kitchen/choma-zone/void-requests';
    }
  }

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
              Wrap(
                spacing: 12,
                runSpacing: 12,
                crossAxisAlignment: WrapCrossAlignment.center,
                children: [
                  SizedBox(
                    width: 420,
                    child: Text('Void Requests',
                        style: Theme.of(context).textTheme.titleLarge),
                  ),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: KitchenDisplayScope.values.map((scope) {
                      final selected = scope == widget.scope;
                      return ChoiceChip(
                        label: Text(scope == KitchenDisplayScope.chomaZone
                            ? 'Choma Zone'
                            : 'Restaurant'),
                        selected: selected,
                        onSelected: selected
                            ? null
                            : (_) => context.go(_routeForScope(scope)),
                      );
                    }).toList(),
                  ),
                  OutlinedButton.icon(
                    onPressed: _refresh,
                    icon: const Icon(Icons.refresh, size: 16),
                    label: const Text('Refresh'),
                  ),
                ],
              ),
              const SizedBox(height: 6),
              Text(
                widget.scope == KitchenDisplayScope.chomaZone
                    ? 'Choma Zone staff submit these when they void an item or a whole bill. Acknowledge to confirm it can be pulled and send it on to the cashier, or decline to keep it on the bill.'
                    : 'Waiters submit these when they void an item or a whole bill. Acknowledge to confirm it can be pulled and send it on to the cashier, or decline to keep it on the bill.',
                style: const TextStyle(color: Color(0xFFAAAFC4), fontSize: 13),
              ),
              const SizedBox(height: 20),
              Text('Items', style: Theme.of(context).textTheme.titleMedium),
              const SizedBox(height: 8),
              if (itemRequests.isEmpty)
                EmptyState(
                  icon: Icons.check_circle_outline,
                  message: widget.scope == KitchenDisplayScope.chomaZone
                      ? 'No Choma Zone item void requests waiting on kitchen.'
                      : 'No item void requests waiting on kitchen.',
                )
              else
                Column(
                    children: [for (final r in itemRequests) _itemCard(r)]),
              const SizedBox(height: 24),
              Text('Whole Bills',
                  style: Theme.of(context).textTheme.titleMedium),
              const SizedBox(height: 8),
              if (billRequests.isEmpty)
                EmptyState(
                  icon: Icons.check_circle_outline,
                  message: widget.scope == KitchenDisplayScope.chomaZone
                      ? 'No Choma Zone bill void requests waiting on kitchen.'
                      : 'No bill void requests waiting on kitchen.',
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
  const KitchenOrderIntelligencePanel({
    super.key,
    this.scope = KitchenDisplayScope.restaurant,
  });

  final KitchenDisplayScope scope;

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
      _repo.getOrders(outletScope: widget.scope),
      _repo.getHistory(limit: 150, outletScope: widget.scope),
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
          subtitle: widget.scope.intelligenceSubtitle,
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
            scope: widget.scope,
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
    this.scope = KitchenDisplayScope.restaurant,
  });

  final List<KitchenOrder> activeOrders;
  final List<KitchenOrder> history;
  final KitchenDisplayScope scope;

  @override
  Widget build(BuildContext context) {
    final source = [...activeOrders, ...history];
    final analytics = _KitchenAnalytics.from(source, scope: scope);
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
                color: const Color(0xFF22C55E).withValues(alpha: _pulse.value),
                boxShadow: [
                  BoxShadow(
                    color: const Color(0xFF22C55E)
                        .withValues(alpha: _pulse.value * 0.6),
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
                        // Show the customer-facing SHORT CODE as the ticket's
                        // primary identifier (falls back to the order number
                        // only when a short code isn't present).
                        (order.shortCode != null && order.shortCode!.isNotEmpty)
                            ? order.shortCode!
                            : order.orderNumber,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          color: Colors.white,
                          fontWeight: FontWeight.w900,
                          fontSize: 28,
                          letterSpacing: 2,
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
                    if (order.captainPrintedAt != null) ...[
                      const SizedBox(height: 2),
                      Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(Icons.print_outlined,
                              color: Colors.white.withValues(alpha: 0.9),
                              size: 12),
                          const SizedBox(width: 3),
                          Text(
                            'Printed ${_kdsKenyaTime(order.captainPrintedAt!)}',
                            style: TextStyle(
                                color: Colors.white.withValues(alpha: 0.9),
                                fontWeight: FontWeight.w700,
                                fontSize: 11),
                          ),
                        ],
                      ),
                    ],
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
            child: Builder(
              builder: (context) {
                // Sort items so original/old items start first, followed by recalled/new items
                final sortedItems = [...order.items]
                  ..sort((a, b) {
                    if (a.isRecalledItem != b.isRecalledItem) {
                      return a.isRecalledItem ? 1 : -1;
                    }
                    return 0;
                  });
                return ListView.separated(
                  padding: const EdgeInsets.all(12),
                  itemCount: sortedItems.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 8),
                  itemBuilder: (context, index) {
                    final item = sortedItems[index];
                    final isRecalledItem = item.isRecalledItem;
                    // Only mark/cross out an item if it was explicitly marked as ready/served
                    final isAlreadyMade = item.isReady;
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
                      // Checkbox to mark this item ready (large, wall-display
                      // friendly). Once ready it stays checked and locked.
                      Transform.scale(
                        scale: 1.4,
                        child: Checkbox(
                          value: item.isReady,
                          onChanged: (item.isReady ||
                                  order.hasPendingVoidRequest ||
                                  order.isVoided ||
                                  isItemVoidActive)
                              ? null
                              : (_) => onItemReady(item),
                          activeColor: AppColors.kSuccess,
                          materialTapTargetSize:
                              MaterialTapTargetSize.shrinkWrap,
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(4),
                          ),
                        ),
                      ),
                    ],
                  ),
                );
              },
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

  factory _KitchenAnalytics.from(
    List<KitchenOrder> orders, {
    KitchenDisplayScope scope = KitchenDisplayScope.restaurant,
  }) {
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
          ? scope == KitchenDisplayScope.chomaZone
              ? 'Once orders flow through the Choma Zone POS, this panel will identify grill demand patterns from item names, quantities and order timing.'
              : 'Once orders flow through the restaurant POS, this panel will identify demand patterns from item names, quantities and order timing.'
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

// ── Live-orders top status filter tabs ───────────────────────────────────────
class _KdsStatusTabs extends StatelessWidget {
  const _KdsStatusTabs({
    required this.active,
    required this.counts,
    required this.onSelected,
  });

  final String active;
  final Map<String, int> counts;
  final ValueChanged<String> onSelected;

  // (key, label, colour)
  static const List<(String, String, Color)> _tabs = [
    ('all', 'ALL', Color(0xFF6B7280)),
    ('new', 'NEW', Color(0xFFF59E0B)),
    ('preparing', 'PREPARING', Color(0xFF2563EB)),
    ('ready', 'READY', Color(0xFF16A34A)),
    ('recalled', 'RECALLED', Color(0xFFDC2626)),
    ('void_pending', 'VOID PENDING', Color(0xFF7F1D1D)),
  ];

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Row(
        children: _tabs.map((t) {
          final key = t.$1;
          final label = t.$2;
          final color = t.$3;
          final selected = active == key;
          final count = counts[key] ?? 0;
          return Padding(
            padding: const EdgeInsets.only(right: 10),
            child: InkWell(
              borderRadius: BorderRadius.circular(10),
              onTap: () => onSelected(key),
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 150),
                padding:
                    const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                decoration: BoxDecoration(
                  color:
                      selected ? color : color.withValues(alpha: 0.14),
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(
                      color: color.withValues(alpha: selected ? 1 : 0.45),
                      width: 1.4),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      label,
                      style: TextStyle(
                        color: selected ? Colors.white : color,
                        fontWeight: FontWeight.w900,
                        fontSize: 13,
                        letterSpacing: 0.6,
                      ),
                    ),
                    const SizedBox(width: 8),
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 8, vertical: 2),
                      decoration: BoxDecoration(
                        color: selected
                            ? Colors.white.withValues(alpha: 0.25)
                            : color,
                        borderRadius: BorderRadius.circular(999),
                      ),
                      child: Text(
                        '$count',
                        style: const TextStyle(
                          color: Colors.white,
                          fontWeight: FontWeight.w900,
                          fontSize: 12,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          );
        }).toList(),
      ),
    );
  }
}

// ── Live-orders bottom table strip (T1 #code · T2 #code · …) ──────────────────
class _KdsTableStrip extends StatelessWidget {
  const _KdsTableStrip({
    required this.tables,
    required this.active,
    required this.onSelected,
  });

  final List<MapEntry<String, String>> tables; // table number -> order code
  final String? active;
  final ValueChanged<String> onSelected;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 4),
      decoration: BoxDecoration(
        color: Colors.black.withValues(alpha: 0.22),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.white.withValues(alpha: 0.08)),
      ),
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        child: Row(
          children: [
            const Padding(
              padding: EdgeInsets.symmetric(horizontal: 10),
              child: Icon(Icons.table_restaurant,
                  color: Colors.white54, size: 18),
            ),
            ...tables.map((e) {
              final table = e.key;
              final code = e.value;
              final selected = active == table;
              return Padding(
                padding: const EdgeInsets.only(right: 8),
                child: InkWell(
                  borderRadius: BorderRadius.circular(8),
                  onTap: () => onSelected(table),
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 14, vertical: 7),
                    decoration: BoxDecoration(
                      color: selected
                          ? AppColors.kAccent
                          : Colors.white.withValues(alpha: 0.06),
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(
                          color: selected
                              ? AppColors.kAccent
                              : Colors.white24),
                    ),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          'T$table',
                          style: TextStyle(
                            color: selected
                                ? const Color(0xFF1A1A2E)
                                : Colors.white,
                            fontWeight: FontWeight.w900,
                            fontSize: 14,
                          ),
                        ),
                        Text(
                          '#$code',
                          style: TextStyle(
                            color: selected
                                ? const Color(0xFF1A1A2E)
                                : Colors.white70,
                            fontWeight: FontWeight.w600,
                            fontSize: 11,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              );
            }),
          ],
        ),
      ),
    );
  }
}
