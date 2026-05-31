import 'dart:async';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../data/repository.dart';
import 'models.dart';

final kdsOrdersProvider =
    StateNotifierProvider<KdsNotifier, AsyncValue<List<KitchenOrder>>>((ref) {
  return KdsNotifier(ref)..start();
});

class KdsNotifier extends StateNotifier<AsyncValue<List<KitchenOrder>>> {
  KdsNotifier(this._ref) : super(const AsyncValue.loading());

  final Ref _ref;
  Timer? _timer;

  void start() {
    _fetch();
    _timer = Timer.periodic(const Duration(seconds: 10), (_) => _fetch());
  }

  Future<void> _fetch() async {
    try {
      final repo = _ref.read(kitchenRepositoryProvider);
      final orders = await repo.getOrders();
      state = AsyncValue.data(orders);
    } catch (error, stackTrace) {
      // Always update state with error so UI can show error state
      state = AsyncValue.error(error, stackTrace);
    }
  }

  Future<void> markItemReady(String orderId, String itemId) async {
    try {
      final repo = _ref.read(kitchenRepositoryProvider);
      await repo.markItemReady(orderId, itemId);
    } catch (_) {}
  }

  void _optimisticUpdate(String orderId, String newStatus) {
    state = AsyncValue.data(
      (state.valueOrNull ?? []).map((order) {
        if (order.id == orderId) {
          return KitchenOrder(
            id: order.id,
            orderNumber: order.orderNumber,
            orderType: order.orderType,
            tableNumber: order.tableNumber,
            waiterName: order.waiterName,
            status: newStatus,
            total: order.total,
            customerName: order.customerName,
            shortCode: order.shortCode,
            source: order.source,
            paymentStatus: order.paymentStatus,
            voidRequestStatus: order.voidRequestStatus,
            items: order.items,
            createdAt: order.createdAt,
            bumpedAt: newStatus == 'ready' ? DateTime.now() : order.bumpedAt,
          );
        }
        return order;
      }).toList(),
    );
  }

  Future<void> startCooking(String orderId) async {
    _optimisticUpdate(orderId, 'preparing');
    try {
      final repo = _ref.read(kitchenRepositoryProvider);
      await repo.updateOrderStatus(orderId, 'preparing');
    } catch (_) {
      _fetch();
    }
  }

  Future<void> markOrderItemsReady(String orderId) async {
    final orders = state.valueOrNull ?? [];
    final order = orders.where((o) => o.id == orderId).firstOrNull;
    if (order == null) return;

    for (final item in order.items.where((i) => !i.isReady)) {
      try {
        await markItemReady(orderId, item.id);
      } catch (_) {}
    }
  }

  Future<void> markReady(String orderId) async {
    await markOrderItemsReady(orderId);
    _optimisticUpdate(orderId, 'ready');
    try {
      final repo = _ref.read(kitchenRepositoryProvider);
      await repo.updateOrderStatus(orderId, 'ready');
    } catch (_) {
      _fetch();
    }
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }
}
