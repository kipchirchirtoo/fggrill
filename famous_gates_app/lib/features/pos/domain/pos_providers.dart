import 'dart:async';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/database/app_database.dart';
import '../../../services/connectivity_service.dart';
import '../data/product_repository.dart';
import '../data/sales_repository.dart';
import 'models.dart';

final productsNotifierProvider =
    StateNotifierProvider<ProductsNotifier, ProductsState>((ref) {
  return ProductsNotifier(ref)..load();
});

final cartNotifierProvider =
    StateNotifierProvider<CartNotifier, CartState>((ref) {
  return CartNotifier();
});

final syncStatusProvider = StreamProvider<SyncStatus>((ref) {
  final database = ref.watch(appDatabaseProvider);
  final online = ref.watch(isOnlineProvider).valueOrNull ?? true;
  return database.offlineSalesDao.watchPendingCount().map((pendingCount) {
    return SyncStatus(pendingCount: pendingCount, isOffline: !online);
  });
});

final mpesaStatusProvider =
    FutureProvider.family<MpesaStatus, String>((ref, checkoutId) async {
  final repository = ref.read(salesRepositoryProvider);
  final deadline = DateTime.now().add(const Duration(seconds: 60));
  while (DateTime.now().isBefore(deadline)) {
    final status = await repository.checkMpesaStatus(checkoutId);
    if (status.status != 'pending') return status;
    await Future.delayed(const Duration(seconds: 3));
  }
  return const MpesaStatus(status: 'failed');
});

class ProductsState {
  const ProductsState({
    this.products = const AsyncValue.loading(),
    this.allProducts = const [],
    this.category,
    this.query = '',
  });

  final AsyncValue<List<Product>> products;
  final List<Product> allProducts;
  final String? category;
  final String query;

  ProductsState copyWith({
    AsyncValue<List<Product>>? products,
    List<Product>? allProducts,
    String? category,
    String? query,
    bool clearCategory = false,
  }) {
    return ProductsState(
      products: products ?? this.products,
      allProducts: allProducts ?? this.allProducts,
      category: clearCategory ? null : category ?? this.category,
      query: query ?? this.query,
    );
  }
}

class ProductsNotifier extends StateNotifier<ProductsState> {
  ProductsNotifier(this._ref) : super(const ProductsState());

  final Ref _ref;

  Future<void> load() async {
    state = state.copyWith(products: const AsyncValue.loading());
    try {
      final products = await _ref.read(productRepositoryProvider).getProducts();
      state = state.copyWith(
        allProducts: products,
        products: AsyncValue.data(
            _applyFilters(products, state.category, state.query)),
      );
    } catch (error, stackTrace) {
      state = state.copyWith(products: AsyncValue.error(error, stackTrace));
    }
  }

  Future<void> refresh() async {
    await _ref
        .read(productRepositoryProvider)
        .refreshProducts(category: state.category);
    await load();
  }

  void filterByCategory(String category) {
    state = state.copyWith(
      category: category,
      products: AsyncValue.data(
          _applyFilters(state.allProducts, category, state.query)),
    );
  }

  void clearCategory() {
    state = state.copyWith(
      clearCategory: true,
      products:
          AsyncValue.data(_applyFilters(state.allProducts, null, state.query)),
    );
  }

  void search(String query) {
    state = state.copyWith(
      query: query,
      products: AsyncValue.data(
          _applyFilters(state.allProducts, state.category, query)),
    );
  }

  List<Product> _applyFilters(
      List<Product> products, String? category, String query) {
    final normalizedQuery = query.trim().toLowerCase();
    return products.where((product) {
      final matchesCategory = category == null || product.category == category;
      final matchesQuery = normalizedQuery.isEmpty ||
          product.name.toLowerCase().contains(normalizedQuery);
      return matchesCategory && matchesQuery;
    }).toList();
  }
}

class CartNotifier extends StateNotifier<CartState> {
  CartNotifier() : super(const CartState());

  void addItem(Product product) {
    CartItem? existing;
    for (final item in state.items) {
      if (item.productId == product.id) {
        existing = item;
        break;
      }
    }
    if (existing == null) {
      state = state.copyWith(
        items: [
          ...state.items,
          CartItem(
            productId: product.id,
            name: product.name,
            unitPrice: product.price,
            qty: 1,
          ),
        ],
      );
      return;
    }
    updateQty(product.id, existing.qty + 1);
  }

  void removeItem(String productId) {
    state = state.copyWith(
      items: state.items.where((item) => item.productId != productId).toList(),
    );
  }

  void updateQty(String productId, int qty) {
    if (qty <= 0) {
      removeItem(productId);
      return;
    }
    state = state.copyWith(
      items: state.items
          .map((item) =>
              item.productId == productId ? item.copyWith(qty: qty) : item)
          .toList(),
    );
  }

  void setPaymentMethod(String method) {
    state = state.copyWith(paymentMethod: method);
  }

  void applyDiscount(double percent, String adminPin) {
    state = state.copyWith(discountPercent: percent.clamp(0, 100));
  }

  void setComplimentary(bool value, String adminPin) {
    state = state.copyWith(isComplimentary: value);
  }

  void restore(List<CartItem> items) {
    state = state.copyWith(items: items);
  }

  void clearCart() {
    state = const CartState();
  }
}
