import 'dart:async';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../data/repository.dart';
import 'models.dart';

final restaurantRecentOrdersProvider =
    FutureProvider.autoDispose<List<RestaurantOrder>>((ref) {
  return ref.read(restaurantRepositoryProvider).getRecentOrders();
});

// Real-time polling provider for restaurant orders
final restaurantOrdersRealtimeProvider = StateNotifierProvider<
    RestaurantOrdersNotifier, AsyncValue<List<RestaurantOrder>>>((ref) {
  return RestaurantOrdersNotifier(ref)..start();
});

class RestaurantOrdersNotifier
    extends StateNotifier<AsyncValue<List<RestaurantOrder>>> {
  RestaurantOrdersNotifier(this._ref) : super(const AsyncValue.loading());

  final Ref _ref;
  Timer? _timer;

  void start() {
    _fetch();
    _timer = Timer.periodic(const Duration(seconds: 5), (_) => _fetch());
  }

  Future<void> _fetch() async {
    try {
      final repo = _ref.read(restaurantRepositoryProvider);
      final orders = await repo.getRecentOrders();
      state = AsyncValue.data(orders);
    } catch (error, stackTrace) {
      state = AsyncValue.error(error, stackTrace);
    }
  }

  Future<void> refresh() async {
    await _fetch();
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }
}
