import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/master_dashboard_shell.dart';
import '../../../core/widgets/widgets.dart';
import '../data/repository.dart';
import '../domain/models.dart';

enum KitchenKdsSection { orders, history, analytics, notifications }

class KDSScreen extends ConsumerStatefulWidget {
  const KDSScreen({super.key, this.initialSection = KitchenKdsSection.orders});

  final KitchenKdsSection initialSection;

  @override
  ConsumerState<KDSScreen> createState() => _KDSScreenState();
}

class _KDSScreenState extends ConsumerState<KDSScreen> {
  late KitchenKdsSection _section;
  late Future<_KitchenModuleSnapshot> _future;
  Timer? _timer;
  String _notificationStatus = 'unread';

  KitchenRepository get _repo => ref.read(kitchenRepositoryProvider);

  @override
  void initState() {
    super.initState();
    _section = widget.initialSection;
    _future = _load();
    _timer = Timer.periodic(const Duration(seconds: 5), (_) {
      if (mounted && _section == KitchenKdsSection.orders) _refresh();
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
    _timer?.cancel();
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
    return _KitchenModuleSnapshot(
      activeOrders: (results[0] as List<KitchenOrder>),
      history: (results[1] as List<KitchenOrder>),
      notifications: (results[2] as List<Map<String, dynamic>>),
    );
  }

  void _refresh() {
    setState(() {
      _future = _load();
    });
  }

  @override
  Widget build(BuildContext context) {
    return MasterDashboardShell<KitchenKdsSection>(
      title: 'Kitchen Display',
      subtitle: 'Restaurant orders only',
      initials: 'KD',
      breadcrumbRoot: 'Kitchen',
      searchHint: 'Search order, item, table...',
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
          section: KitchenKdsSection.notifications,
          label: 'Notifications',
          icon: Icons.notifications_active_outlined,
          group: 'Kitchen Display',
        ),
      ],
      onSectionSelected: (section) => setState(() => _section = section),
      child: FutureBuilder<_KitchenModuleSnapshot>(
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
            return ErrorState(message: '${snapshot.error}', onRetry: _refresh);
          }
          final data = snapshot.data ?? _KitchenModuleSnapshot.empty();
          switch (_section) {
            case KitchenKdsSection.orders:
              return _orders(data);
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

  Widget _orders(_KitchenModuleSnapshot data) {
    final pending = data.activeOrders
        .where(
            (order) => order.status == 'pending' || order.status == 'confirmed')
        .length;
    final preparing =
        data.activeOrders.where((order) => order.status == 'preparing').length;
    final ready =
        data.activeOrders.where((order) => order.status == 'ready').length;
    final avgWait = data.activeOrders.isEmpty
        ? 0
        : (data.activeOrders
                    .map((order) => order.elapsed.inMinutes)
                    .reduce((a, b) => a + b) /
                data.activeOrders.length)
            .round();

    return _Page(
      title: 'Restaurant Kitchen Orders',
      subtitle:
          'Live restaurant order queue from POS. Bar orders are excluded by using restaurant order tables only.',
      actions: [
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
              _StatTile('Avg Wait', '${avgWait}m'),
            ],
          ),
          const SizedBox(height: 24),
          if (data.activeOrders.isEmpty)
            const EmptyState(message: 'No active restaurant orders.')
          else
            LayoutBuilder(
              builder: (context, constraints) {
                final width = constraints.maxWidth;
                final columns = width > 1320
                    ? 4
                    : width > 960
                        ? 3
                        : width > 640
                            ? 2
                            : 1;
                return GridView.builder(
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
                    crossAxisCount: columns,
                    crossAxisSpacing: 14,
                    mainAxisSpacing: 14,
                    childAspectRatio: 0.82,
                  ),
                  itemCount: data.activeOrders.length,
                  itemBuilder: (context, index) => _OrderTicket(
                    order: data.activeOrders[index],
                    onStart: () => _updateOrder(
                      data.activeOrders[index].id,
                      'preparing',
                      'Order started',
                    ),
                    onReady: () => _updateOrder(
                      data.activeOrders[index].id,
                      'ready',
                      'Waiter notification sent',
                    ),
                    onServed: () => _updateOrder(
                      data.activeOrders[index].id,
                      'served',
                      'Order moved to history',
                    ),
                  ),
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
    final source = [...data.activeOrders, ...data.history];
    final analytics = _KitchenAnalytics.from(source);
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
      child: Column(
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
                  ratio: source.isEmpty
                      ? 0
                      : analytics.urgentOrders / source.length,
                ),
                _MetricRow(
                  label: 'Ready waiting for waiter',
                  value: '${analytics.readyOrders}',
                  ratio: data.activeOrders.isEmpty
                      ? 0
                      : analytics.readyOrders / data.activeOrders.length,
                ),
              ],
            ),
          ),
        ],
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
    required this.onStart,
    required this.onReady,
    required this.onServed,
  });

  final KitchenOrder order;
  final VoidCallback onStart;
  final VoidCallback onReady;
  final VoidCallback onServed;

  @override
  Widget build(BuildContext context) {
    final status = order.status.toLowerCase();
    final urgent = order.isUrgent;
    final color = status == 'ready'
        ? AppColors.kSuccess
        : status == 'preparing'
            ? Colors.blue
            : urgent
                ? AppColors.kError
                : AppColors.kWarning;
    return Card(
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            color: color,
            padding: const EdgeInsets.all(12),
            child: Row(
              children: [
                Expanded(
                  child: Text(
                    '#${order.orderNumber}',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      color: Colors.white,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
                Text(
                  '${order.elapsed.inMinutes}m',
                  style: const TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(12),
            child: Row(
              children: [
                Icon(Icons.table_restaurant_outlined,
                    size: 18, color: Colors.grey.shade600),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    order.locationLabel,
                    style: const TextStyle(fontWeight: FontWeight.w700),
                  ),
                ),
                _StatusPill(status: status),
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
                return Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: AppColors.kSurface,
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: AppColors.kDivider),
                  ),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        '${item.quantity}x',
                        style: const TextStyle(
                          fontWeight: FontWeight.bold,
                          color: AppColors.kPrimary,
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(item.name,
                                style: const TextStyle(
                                    fontWeight: FontWeight.w700)),
                            if (item.notes != null && item.notes!.isNotEmpty)
                              Text(
                                'Note: ${item.notes}',
                                style: const TextStyle(
                                  color: AppColors.kWarning,
                                  fontSize: 12,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                          ],
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
    return const SizedBox.shrink();
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
          return ListTile(
            leading: const Icon(Icons.receipt_long_outlined),
            title: Text('#${order.orderNumber} • ${order.locationLabel}'),
            subtitle: Text(
              '${order.items.map((item) => '${item.quantity}x ${item.name}').join(', ')}\n${order.createdAt}',
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
            ),
            trailing: _StatusPill(status: order.status),
          );
        },
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
    final color = normalized == 'ready' ||
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
