import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../data/bar_repository.dart';
import 'models.dart';

// --- Drinks ---

final barDrinksProvider = FutureProvider<List<BarDrink>>((ref) async {
  final repo = ref.read(barRepositoryProvider);
  return repo.getDrinks();
});

final barCategoriesProvider = FutureProvider<List<BarCategory>>((ref) async {
  final repo = ref.read(barRepositoryProvider);
  return repo.getCategories();
});

final filteredDrinksProvider =
    Provider.family<List<BarDrink>, String?>((ref, categoryId) {
  final drinksAsync = ref.watch(barDrinksProvider);
  return drinksAsync.whenOrNull(
        data: (drinks) {
          if (categoryId == null) return drinks;
          return drinks.where((d) => d.categoryId == categoryId).toList();
        },
      ) ??
      [];
});

// --- Orders ---

final barOrdersProvider =
    StateNotifierProvider<BarOrdersNotifier, AsyncValue<List<BarOrder>>>((ref) {
  return BarOrdersNotifier(ref)..load();
});

class BarOrdersNotifier extends StateNotifier<AsyncValue<List<BarOrder>>> {
  BarOrdersNotifier(this._ref) : super(const AsyncValue.loading());

  final Ref _ref;
  String _statusFilter = '';

  String get statusFilter => _statusFilter;

  Future<void> load({String? status}) async {
    state = const AsyncValue.loading();
    _statusFilter = status ?? '';
    try {
      final repo = _ref.read(barRepositoryProvider);
      final orders = await repo.getOrders(status: status);
      state = AsyncValue.data(orders);
    } catch (error, stackTrace) {
      state = AsyncValue.error(error, stackTrace);
    }
  }

  Future<void> refresh() => load(status: _statusFilter);

  Future<void> updateStatus(String orderId, String status) async {
    try {
      final repo = _ref.read(barRepositoryProvider);
      await repo.updateOrderStatus(orderId, status);
      await refresh();
    } catch (_) {}
  }
}

// --- Tabs ---

final barTabsProvider =
    StateNotifierProvider<BarTabsNotifier, AsyncValue<List<BarTab>>>((ref) {
  return BarTabsNotifier(ref)..load();
});

class BarTabsNotifier extends StateNotifier<AsyncValue<List<BarTab>>> {
  BarTabsNotifier(this._ref) : super(const AsyncValue.loading());

  final Ref _ref;
  String _statusFilter = '';

  String get statusFilter => _statusFilter;

  Future<void> load({String? status}) async {
    state = const AsyncValue.loading();
    _statusFilter = status ?? '';
    try {
      final repo = _ref.read(barRepositoryProvider);
      final tabs = await repo.getTabs(status: status);
      state = AsyncValue.data(tabs);
    } catch (error, stackTrace) {
      state = AsyncValue.error(error, stackTrace);
    }
  }

  Future<void> refresh() => load(status: _statusFilter);

  Future<void> createTab(CreateBarTabRequest request) async {
    try {
      final repo = _ref.read(barRepositoryProvider);
      await repo.createTab(request);
      await refresh();
    } catch (_) {}
  }

  Future<void> closeTab(String tabId, String paymentMethod) async {
    try {
      final repo = _ref.read(barRepositoryProvider);
      await repo.closeTab(tabId, CloseTabRequest(paymentMethod: paymentMethod));
      await refresh();
    } catch (_) {}
  }

  Future<void> deleteTab(String tabId) async {
    try {
      final repo = _ref.read(barRepositoryProvider);
      await repo.deleteTab(tabId);
      await refresh();
    } catch (_) {}
  }
}

// --- Stock ---

final barStockProvider =
    StateNotifierProvider<BarStockNotifier, AsyncValue<List<StockItem>>>((ref) {
  return BarStockNotifier(ref)..load();
});

class BarStockNotifier extends StateNotifier<AsyncValue<List<StockItem>>> {
  BarStockNotifier(this._ref) : super(const AsyncValue.loading());

  final Ref _ref;

  Future<void> load() async {
    state = const AsyncValue.loading();
    try {
      final repo = _ref.read(barRepositoryProvider);
      final stock = await repo.getStock();
      state = AsyncValue.data(stock);
    } catch (error, stackTrace) {
      state = AsyncValue.error(error, stackTrace);
    }
  }

  Future<void> refresh() => load();

  Future<void> syncFromMaster() async {
    try {
      final repo = _ref.read(barRepositoryProvider);
      await repo.syncFromMaster();
      await refresh();
    } catch (_) {}
  }
}

// --- Morning Count ---

final morningCountProvider =
    FutureProvider<List<MorningCountItem>>((ref) async {
  final repo = ref.read(barRepositoryProvider);
  final stock = await repo.getStock();
  return stock.map((s) {
    return MorningCountItem(
      drinkId: s.id,
      name: s.drinkName,
      systemQuantity: s.currentStock,
    );
  }).toList();
});
