import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/network/dio_client.dart';
import '../../../core/storage/secure_storage_provider.dart';
import '../../auth/data/auth_repository.dart';
import '../domain/models.dart';

final storeRepositoryProvider = Provider<StoreRepository>((ref) {
  return StoreRepository(ref.read(dioProvider), ref);
});

class StoreRepository {
  StoreRepository(this._dio, this._ref);

  final Dio _dio;
  final Ref _ref;

  Future<String> get _branchId async {
    final storage = _ref.read(secureStorageProvider);
    return await storage.read(key: AuthRepository.branchIdKey) ?? '';
  }

  Map<String, dynamic> _unwrap(dynamic data) {
    if (data is Map && data['success'] == true && data['data'] != null) {
      return Map<String, dynamic>.from(data['data']);
    }
    return Map<String, dynamic>.from(data ?? {});
  }

  List<T> _parseList<T>(
      dynamic data, T Function(Map<String, dynamic>) fromJson) {
    final list =
        data is List ? data : (data is Map ? (data['data'] ?? []) : []);
    return (list as List)
        .whereType<Map>()
        .map((json) => fromJson(Map<String, dynamic>.from(json)))
        .toList();
  }

  Future<Map<String, dynamic>> getDashboard() async {
    final branchId = await _branchId;
    final response =
        await _dio.get('/store/dashboard/branch', queryParameters: {
      if (branchId.isNotEmpty) 'branch_id': branchId,
    });
    return _unwrap(response.data);
  }

  Future<List<InventoryItem>> getItems(
      {String? search, String? category}) async {
    final branchId = await _branchId;
    final response = await _dio.get('/store/items', queryParameters: {
      if (branchId.isNotEmpty) 'branch_id': branchId,
      if (search != null) 'search': search,
      if (category != null) 'category': category,
    });
    return _parseList(response.data, InventoryItem.fromJson);
  }

  Future<List<InventoryItem>> getBranchStock() async {
    final branchId = await _branchId;
    final response = await _dio.get('/store/branch-stock', queryParameters: {
      if (branchId.isNotEmpty) 'branch_id': branchId,
    });
    return _parseList(response.data, InventoryItem.fromJson);
  }

  Future<List<InventoryItem>> getLowStockItems() async {
    final branchId = await _branchId;
    final response =
        await _dio.get('/store/branch-stock/low', queryParameters: {
      if (branchId.isNotEmpty) 'branch_id': branchId,
    });
    return _parseList(response.data, InventoryItem.fromJson);
  }

  Future<List<StockRequest>> getStockRequests({String? status}) async {
    final branchId = await _branchId;
    final response = await _dio.get('/store/stock-requests', queryParameters: {
      if (branchId.isNotEmpty) 'branch_id': branchId,
      if (status != null) 'status': status,
    });
    return _parseList(response.data, StockRequest.fromJson);
  }

  Future<List<Supplier>> getSuppliers() async {
    final response = await _dio.get('/store/suppliers');
    return _parseList(response.data, Supplier.fromJson);
  }

  Future<void> createStockRequest(Map<String, dynamic> data) async {
    final branchId = await _branchId;
    await _dio.post('/store/stock-requests', data: {
      ...data,
      if (branchId.isNotEmpty) 'requesting_branch_id': int.tryParse(branchId),
    });
  }

  Future<void> createItem(Map<String, dynamic> data) async {
    await _dio.post('/store/items', data: data);
  }

  // Dispatch
  Future<List<Map<String, dynamic>>> getDispatchOrders({String? status}) async {
    final response = await _dio.get('/store/dispatch-notes', queryParameters: {
      if (status != null) 'status': status,
    });
    return _parseList(response.data, (j) => j);
  }

  Future<void> createDispatchOrder(Map<String, dynamic> data) async {
    await _dio.post('/store/dispatch-notes', data: data);
  }

  Future<void> updateDispatchStatus(String id, String status) async {
    if (status.toUpperCase() == 'DISPATCHED' ||
        status.toUpperCase() == 'IN_TRANSIT') {
      await _dio.put('/store/dispatch-notes/$id/dispatch');
      return;
    }
    await _dio
        .put('/store/dispatch-notes/$id/status', data: {'status': status});
  }

  // Receiving
  Future<List<Map<String, dynamic>>> getReceivingRecords() async {
    final branchId = await _branchId;
    final response =
        await _dio.get('/store/incoming-dispatches', queryParameters: {
      if (branchId.isNotEmpty) 'branch_id': branchId,
    });
    return _parseList(response.data, (j) => j);
  }

  Future<void> recordReceiving(Map<String, dynamic> data) async {
    final dispatchId = data['dispatch_id'] ?? data['id'];
    if (dispatchId != null && '$dispatchId'.isNotEmpty) {
      await _dio.put('/store/dispatch-notes/$dispatchId/confirm', data: data);
      return;
    }

    await _dio.post('/store/branch-stock/receive-supplier', data: data);
  }

  // Spoilage / Packing
  Future<List<Map<String, dynamic>>> getSpoilageRecords() async {
    final response = await _dio.get('/store/central-spoilage');
    return _parseList(response.data, (j) => j);
  }

  Future<void> recordSpoilage(Map<String, dynamic> data) async {
    await _dio.post('/store/central-spoilage', data: data);
  }

  Future<List<Map<String, dynamic>>> getPackingRecords() async {
    final response = await _dio.get('/store/stock-requests', queryParameters: {
      'status': 'APPROVED',
    });
    return _parseList(response.data, (j) => j);
  }

  // Supplier CRUD
  Future<void> createSupplier(Map<String, dynamic> data) async {
    await _dio.post('/store/suppliers', data: data);
  }

  Future<void> updateSupplier(String id, Map<String, dynamic> data) async {
    await _dio.put('/store/suppliers/$id', data: data);
  }

  Future<void> deleteSupplier(String id) async {
    await _dio.delete('/store/suppliers/$id');
  }

  // Fleet / Vehicles / Drivers
  Future<List<Map<String, dynamic>>> getFleetVehicles() async {
    final response = await _dio.get('/store/vehicles');
    return _parseList(response.data, (j) => j);
  }

  Future<List<Map<String, dynamic>>> getFleetDrivers() async {
    final response = await _dio.get('/store/drivers');
    return _parseList(response.data, (j) => j);
  }

  Future<List<Map<String, dynamic>>> getFleetTrips() async {
    final branchId = await _branchId;
    final response = await _dio.get('/fleet/trips', queryParameters: {
      if (branchId.isNotEmpty) 'branch_id': branchId,
    });
    return _parseList(response.data, (j) => j);
  }

  Future<void> createFleetTrip(Map<String, dynamic> data) async {
    await _dio.post('/fleet/trips', data: data);
  }

  Future<List<Map<String, dynamic>>> getResource(String path,
      {Map<String, dynamic>? queryParameters}) async {
    final parsed = Uri.tryParse(path);
    final cleanPath = parsed != null && parsed.hasQuery ? parsed.path : path;
    final mergedQuery = <String, dynamic>{
      if (parsed != null) ...parsed.queryParameters,
      ...?queryParameters,
    };
    final response = await _dio.get(
      cleanPath,
      queryParameters: mergedQuery.isEmpty ? null : mergedQuery,
    );
    final data = response.data;
    final payload = data is List
        ? data
        : data is Map
            ? (data['data'] ??
                data['items'] ??
                data['rows'] ??
                data['results'] ??
                data)
            : [];
    final list = payload is List ? payload : <dynamic>[payload];
    return list
        .whereType<Map>()
        .map((json) => Map<String, dynamic>.from(json))
        .toList();
  }

  Future<void> createResource(String path, Map<String, dynamic> data) async {
    await _dio.post(path, data: data);
  }
}
