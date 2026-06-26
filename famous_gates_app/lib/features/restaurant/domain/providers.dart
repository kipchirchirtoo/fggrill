import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/realtime/realtime_service.dart';
import '../../../core/storage/secure_storage_provider.dart';
import '../../auth/data/auth_repository.dart';
import '../data/repository.dart';
import 'models.dart';

final restaurantRecentOrdersProvider =
    FutureProvider.autoDispose<List<RestaurantOrder>>((ref) {
  return ref.read(restaurantRepositoryProvider).getRecentOrders();
});

// Real-time provider for restaurant orders — backed by Supabase Realtime with
// a polling fallback when the Realtime channel is unavailable.
final restaurantOrdersRealtimeProvider = StateNotifierProvider<
    RestaurantOrdersNotifier, AsyncValue<List<RestaurantOrder>>>((ref) {
  return RestaurantOrdersNotifier(ref)..start();
});

class RestaurantOrdersNotifier
    extends StateNotifier<AsyncValue<List<RestaurantOrder>>> {
  RestaurantOrdersNotifier(this._ref) : super(const AsyncValue.loading());

  final Ref _ref;
  StreamSubscription<OrderItemRealtimeEvent>? _realtimeSub;
  Timer? _fallbackTimer;

  Future<void> start() async {
    await _fetch();
    await _subscribeRealtime();
  }

  Future<void> _subscribeRealtime() async {
    final storage = _ref.read(secureStorageProvider);
    final branchIdStr =
        await storage.read(key: AuthRepository.branchIdKey) ?? '';
    final branchId = int.tryParse(branchIdStr.trim());

    if (branchId == null) {
      debugPrint(
          '⚠️ RestaurantOrdersNotifier: No branchId — falling back to polling.');
      _startFallbackPolling();
      return;
    }

    final realtimeService = _ref.read(realtimeServiceProvider);
    final stream = realtimeService.watchOrderItems(branchId);

    _realtimeSub = stream.listen(
      (event) {
        debugPrint(
            '🔴 Restaurant Realtime event: ${event.eventType} order=${event.orderId}');
        _fetch();
      },
      onError: (Object err) {
        debugPrint('❌ RestaurantOrdersNotifier Realtime error: $err');
        _startFallbackPolling();
      },
    );
  }

  void _startFallbackPolling() {
    _fallbackTimer?.cancel();
    _fallbackTimer =
        Timer.periodic(const Duration(seconds: 5), (_) => _fetch());
  }

  Future<void> _fetch() async {
    try {
      final repo = _ref.read(restaurantRepositoryProvider);
      final orders = await repo.getRecentOrders();
      if (mounted) state = AsyncValue.data(orders);
    } catch (error, stackTrace) {
      if (mounted) state = AsyncValue.error(error, stackTrace);
    }
  }

  Future<void> refresh() async {
    await _fetch();
  }

  @override
  void dispose() {
    _realtimeSub?.cancel();
    _fallbackTimer?.cancel();
    super.dispose();
  }
}
