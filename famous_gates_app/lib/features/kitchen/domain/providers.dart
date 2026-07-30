import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/realtime/realtime_service.dart';
import '../../../core/storage/secure_storage_provider.dart';
import '../../auth/data/auth_repository.dart';
import '../data/repository.dart';
import 'display_scope.dart';
import 'models.dart';

final kdsOrdersProvider =
    StateNotifierProvider<KdsNotifier, AsyncValue<List<KitchenOrder>>>((ref) {
  return KdsNotifier(ref)..start();
});

final chomaZoneKdsOrdersProvider =
    StateNotifierProvider<KdsNotifier, AsyncValue<List<KitchenOrder>>>((ref) {
  return KdsNotifier(ref, outletScope: KitchenDisplayScope.chomaZone)..start();
});

class KdsNotifier extends StateNotifier<AsyncValue<List<KitchenOrder>>> {
  KdsNotifier(
    this._ref, {
    this.outletScope = KitchenDisplayScope.restaurant,
  }) : super(const AsyncValue.loading());

  final Ref _ref;
  final KitchenDisplayScope outletScope;
  StreamSubscription<OrderItemRealtimeEvent>? _realtimeSub;
  // Polling timer — always active, parallel to Realtime, so cards appear
  // within 5 s even while Realtime is still connecting/authenticating.
  Timer? _fallbackTimer;
  Future<void>? _inFlightFetch;
  DateTime? _lastFetchAt;

  Future<void> start() async {
    await _fetch(force: true);
    // Start fallback polling immediately — parallel to Realtime, not only
    // when Realtime fails. This guarantees cards appear within 5 s even
    // during the Realtime auth/connect window. Realtime events still
    // trigger an extra _fetch() for near-instant updates once connected.
    _startFallbackPolling();
    _subscribeRealtime();
  }

  Future<void> _subscribeRealtime() async {
    final storage = _ref.read(secureStorageProvider);
    final branchIdStr =
        await storage.read(key: AuthRepository.branchIdKey) ?? '';
    final branchId = int.tryParse(branchIdStr.trim());

    if (branchId == null) {
      debugPrint(
          '⚠️ KdsNotifier: No branchId found — polling only.');
      return;
    }

    final realtimeService = _ref.read(realtimeServiceProvider);
    final stream = realtimeService.watchOrderItems(branchId);

    _realtimeSub = stream.listen(
      (event) {
        debugPrint(
            '🔴 KDS Realtime event: ${event.eventType} order=${event.orderId} status=${event.status}');
        // On any change, refresh from server to get full order details.
        _fetch();
      },
      onError: (Object err) {
        debugPrint('❌ KDS Realtime subscription error: $err — polling continues.');
      },
    );

    // Status stream for connection indicator
    realtimeService.statusStream.listen((status) {
      debugPrint('🔌 KDS Realtime status: $status');
    });
  }

  void _startFallbackPolling() {
    _fallbackTimer?.cancel();
    _fallbackTimer =
        Timer.periodic(const Duration(seconds: 5), (_) => _fetch());
  }

  Future<void> _fetch({bool force = false}) {
    if (_inFlightFetch != null) {
      return _inFlightFetch!;
    }
    if (!force &&
        _lastFetchAt != null &&
        DateTime.now().difference(_lastFetchAt!) <
            const Duration(milliseconds: 800)) {
      return Future.value();
    }
    final future = _performFetch();
    _inFlightFetch = future;
    return future.whenComplete(() {
      _lastFetchAt = DateTime.now();
      _inFlightFetch = null;
    });
  }

  Future<void> _performFetch() async {
    // Skip network request when unauthenticated — avoids a 401 spam loop
    // where the fallback timer keeps polling after session expiry. The
    // auth interceptor handles the first 401, but because this provider is
    // not autoDispose the timer outlives the KDS screen, so we guard here.
    final storage = _ref.read(secureStorageProvider);
    final jwt = await storage.read(key: AuthRepository.jwtKey);
    final isLoggedIn =
        jwt != null && jwt.trim().isNotEmpty && jwt.toLowerCase() != 'null';
    if (!isLoggedIn) return;

    try {
      final repo = _ref.read(kitchenRepositoryProvider);
      final orders = await repo.getOrders(outletScope: outletScope);
      if (mounted) state = AsyncValue.data(orders);
    } catch (error, stackTrace) {
      if (mounted) state = AsyncValue.error(error, stackTrace);
    }
  }

  /// Manual refresh entry point for callers outside this notifier (the KDS
  /// screen's Refresh button and post-action refreshes like void
  /// acknowledgement) — without this, those only ever touched the separate
  /// History/Analytics FutureBuilder and never actually reloaded this
  /// provider's order grid.
  Future<void> refresh() => _fetch(force: true);

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
    _realtimeSub?.cancel();
    _fallbackTimer?.cancel();
    super.dispose();
  }
}
