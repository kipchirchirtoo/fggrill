import 'dart:async';
import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/database/app_database.dart';
import '../../../core/network/dio_client.dart';
import '../../../core/storage/secure_storage_provider.dart';
import '../../auth/data/auth_repository.dart';
import '../domain/models.dart';

final productRepositoryProvider = Provider<ProductRepository>((ref) {
  return ProductRepository(
    ref.read(dioProvider),
    ref.read(appDatabaseProvider).productsCacheDao,
    ref,
  );
});

class ProductRepository {
  ProductRepository(this._dio, this._cacheDao, this._ref);

  final Dio _dio;
  final ProductsCacheDao _cacheDao;
  final Ref _ref;

  Future<List<Product>> getProducts({String? category}) async {
    Future<List<Product>> fromCache() async {
      final cached = category == null
          ? await _cacheDao.getAll()
          : await _cacheDao.getByCategory(category);
      return cached.map(_fromCache).toList();
    }

    try {
      final cached = await (category == null
          ? _cacheDao.getAll()
          : _cacheDao.getByCategory(category));
      final cutoff = DateTime.now()
          .subtract(const Duration(hours: 24))
          .millisecondsSinceEpoch;
      if (cached.isNotEmpty &&
          cached.any((item) => item.lastSynced >= cutoff)) {
        return cached.map(_fromCache).toList();
      }
    } catch (_) {}

    final apiProducts = await _fetchFromApi(category: category);
    if (apiProducts.isNotEmpty) {
      unawaited(_cacheProducts(apiProducts));
      return apiProducts;
    }

    try {
      return await fromCache();
    } catch (_) {
      return [];
    }
  }

  Future<List<Product>> _fetchFromApi({String? category}) async {
    debugPrint('=== _fetchFromApi START ===');
    final storage = _ref.read(secureStorageProvider);
    final branchId = await storage.read(key: AuthRepository.branchIdKey);
    debugPrint('branchId: $branchId');
    debugPrint('category: $category');
    final response = await _dio.get('/restaurant/menu/items', queryParameters: {
      if (branchId != null) 'branch_id': branchId,
      if (category != null && category.isNotEmpty) 'category': category,
      'available': true,
    });
    debugPrint('response.statusCode: ${response.statusCode}');
    debugPrint('response.data type: ${response.data.runtimeType}');
    debugPrint('response.data: ${response.data}');
    final payload = response.data;
    final list = payload is List
        ? payload
        : (payload is Map
            ? (payload['data'] ?? payload['items'] ?? payload['products'] ?? [])
            : []);
    debugPrint('list length: ${list.length}');
    final result = (list as List)
        .map((json) => Product.fromJson(Map<String, dynamic>.from(json as Map)))
        .toList();
    debugPrint('result length: ${result.length}');
    debugPrint('=== _fetchFromApi END ===');
    return result;
  }

  Future<void> _cacheProducts(List<Product> products) async {
    try {
      final now = DateTime.now().millisecondsSinceEpoch;
      final entries = products
          .map((product) => ProductCacheEntry(
                id: product.id,
                name: product.name,
                category: product.category,
                price: product.price,
                unit: product.unit,
                isActive: product.isActive,
                lastSynced: now,
              ))
          .toList();
      for (final entry in entries) {
        await _cacheDao.upsert(entry);
      }
    } catch (_) {}
  }

  Future<void> refreshProducts({String? category}) async {
    final products = await _fetchFromApi(category: category);
    if (products.isNotEmpty) {
      unawaited(_cacheProducts(products));
    }
  }

  Product _fromCache(ProductCacheEntry entry) {
    return Product(
      id: entry.id,
      name: entry.name,
      category: entry.category,
      price: entry.price,
      unit: entry.unit,
      isActive: entry.isActive,
    );
  }
}
