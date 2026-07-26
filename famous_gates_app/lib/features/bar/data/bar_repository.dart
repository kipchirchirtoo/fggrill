import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/network/dio_client.dart';
import '../../../core/storage/secure_storage_provider.dart';
import '../../auth/data/auth_repository.dart';
import '../domain/models.dart';

final barRepositoryProvider = Provider<BarRepository>((ref) {
  return BarRepository(ref.read(dioProvider), ref);
});

class BarRepository {
  BarRepository(this._dio, this._ref);

  final Dio _dio;
  final Ref _ref;

  Future<String> get _branchId async {
    final storage = _ref.read(secureStorageProvider);
    return await storage.read(key: AuthRepository.branchIdKey) ?? '';
  }

  Map<String, dynamic> _unwrap(dynamic responseData) {
    if (responseData is Map) {
      if (responseData.containsKey('data') && responseData['data'] is Map) {
        return Map<String, dynamic>.from(responseData['data'] as Map);
      }
      return Map<String, dynamic>.from(responseData);
    }
    return <String, dynamic>{};
  }

  List<dynamic> _unwrapList(dynamic responseData) {
    if (responseData is List) return responseData;
    if (responseData is Map) {
      final data = responseData['data'];
      if (data is List) return data;
      final items = responseData['items'] ??
          responseData['drinks'] ??
          responseData['orders'] ??
          responseData['tabs'];
      if (items is List) return items;
    }
    return [];
  }

  // --- Drinks ---

  /// Fetches drinks from POS outlet items (with real-time stock sync)
  /// for the main bar POS. This ensures stock quantities match database.
  Future<List<BarDrink>> getDrinks({String? categoryId}) async {
    final branchId = await _branchId;
    
    // First, get the main bar POS outlet for this branch
    final outletsResponse = await _dio.get('/pos/outlets', queryParameters: {
      if (branchId.isNotEmpty) 'branch_id': branchId,
      'outlet_type': 'main_bar',
    });
    
    final outlets = _unwrapList(outletsResponse.data);
    if (outlets.isEmpty) {
      // Fallback to regular drinks API if no POS outlet configured
      final response = await _dio.get('/bar/drinks', queryParameters: {
        if (branchId.isNotEmpty) 'branch_id': branchId,
        if (categoryId != null) 'category_id': categoryId,
      });
      final list = _unwrapList(response.data);
      return list
          .whereType<Map>()
          .map((json) => BarDrink.fromJson(Map<String, dynamic>.from(json)))
          .toList();
    }
    
    final outletId = outlets.first['id'].toString();
    
    // Fetch POS outlet items with real-time stock
    final response = await _dio.get('/pos/outlets/$outletId/items');
    final list = _unwrapList(response.data);
    
    // Map POS outlet items to BarDrink format
    final drinks = list.whereType<Map>().map((json) {
      final item = Map<String, dynamic>.from(json);
      return BarDrink.fromJson({
        'id': item['id'],
        'name': item['name'],
        'category_id': item['category_id'],
        'category_name': item['category_name'],
        'price': item['selling_price'] ?? item['price'] ?? 0,
        'unit': item['unit'],
        'is_available': (item['is_active'] ?? true) && 
                       (item['current_stock'] ?? 0) > 0,
        'stock_quantity': item['current_stock'] ?? 0,
      });
    }).toList();
    
    // Filter by category if specified
    if (categoryId != null) {
      return drinks.where((d) => d.categoryId == categoryId).toList();
    }
    
    return drinks;
  }

  // --- Categories ---

  Future<List<BarCategory>> getCategories() async {
    final branchId = await _branchId;
    final response = await _dio.get('/bar/categories', queryParameters: {
      if (branchId.isNotEmpty) 'branch_id': branchId,
    });
    final list = _unwrapList(response.data);
    return list
        .whereType<Map>()
        .map((json) => BarCategory.fromJson(Map<String, dynamic>.from(json)))
        .toList();
  }

  // --- Orders ---

  Future<List<BarOrder>> getOrders({String? status}) async {
    final branchId = await _branchId;
    final response = await _dio.get('/bar/orders', queryParameters: {
      if (branchId.isNotEmpty) 'branch_id': branchId,
      if (status != null && status.isNotEmpty) 'status': status,
    });
    final list = _unwrapList(response.data);
    return list
        .whereType<Map>()
        .map((json) => BarOrder.fromJson(Map<String, dynamic>.from(json)))
        .toList();
  }

  Future<BarOrder> createOrder(CreateBarOrderRequest request) async {
    final response = await _dio.post('/bar/orders', data: request.toJson());
    final data = _unwrap(response.data);
    return BarOrder.fromJson(data);
  }

  Future<void> updateOrderStatus(String orderId, String status) async {
    await _dio.put('/bar/orders/$orderId/status', data: {'status': status});
  }

  // --- Tabs ---

  Future<List<BarTab>> getTabs({String? status}) async {
    final branchId = await _branchId;
    final response = await _dio.get('/bar/tabs', queryParameters: {
      if (branchId.isNotEmpty) 'branch_id': branchId,
      if (status != null && status.isNotEmpty) 'status': status,
    });
    final list = _unwrapList(response.data);
    return list
        .whereType<Map>()
        .map((json) => BarTab.fromJson(Map<String, dynamic>.from(json)))
        .toList();
  }

  Future<BarTab> createTab(CreateBarTabRequest request) async {
    final response = await _dio.post('/bar/tabs', data: request.toJson());
    final data = _unwrap(response.data);
    return BarTab.fromJson(data);
  }

  Future<void> updateTab(String tabId, Map<String, dynamic> data) async {
    await _dio.put('/bar/tabs/$tabId', data: data);
  }

  Future<void> closeTab(String tabId, CloseTabRequest request) async {
    await _dio.post('/bar/tabs/$tabId/close', data: request.toJson());
  }

  Future<void> deleteTab(String tabId) async {
    await _dio.delete('/bar/tabs/$tabId');
  }

  // --- Stock ---

  Future<List<StockItem>> getStock() async {
    final branchId = await _branchId;
    final response = await _dio.get('/bar/stock', queryParameters: {
      if (branchId.isNotEmpty) 'branch_id': branchId,
    });
    final list = _unwrapList(response.data);
    return list
        .whereType<Map>()
        .map((json) => StockItem.fromJson(Map<String, dynamic>.from(json)))
        .toList();
  }

  Future<void> syncFromMaster() async {
    await _dio.post('/bar/stock/sync');
  }

  Future<List<StockItem>> getLowStockItems() async {
    final branchId = await _branchId;
    final response =
        await _dio.get('/bar/stock-requests/low-stock', queryParameters: {
      if (branchId.isNotEmpty) 'branch_id': branchId,
    });
    final list = _unwrapList(response.data);
    return list
        .whereType<Map>()
        .map((json) => StockItem.fromJson(Map<String, dynamic>.from(json)))
        .toList();
  }

  // --- Stock Take / Morning Count ---

  Future<void> submitStockTake(StockTakeSubmission submission) async {
    await _dio.post('/bar/stock/stock-take', data: submission.toJson());
  }
}
