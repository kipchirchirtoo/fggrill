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

  Future<Map<String, dynamic>> getDashboard({bool central = false}) async {
    final branchId = await _branchId;
    final endpoint =
        central ? '/store/dashboard/central' : '/store/dashboard/branch';
    final response = await _dio.get(endpoint, queryParameters: {
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
    await _dio.put('/storekeeping/dispatch-notes/$id/status',
        data: {'status': status});
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
  Future<List<Map<String, dynamic>>> getSpoilageRecords({
    String? reason,
    String? status,
    String? storeType,
  }) async {
    final response = await _dio.get('/wastage', queryParameters: {
      if (reason != null && reason.isNotEmpty) 'reason': reason,
      if (status != null && status.isNotEmpty) 'status': status,
      if (storeType != null && storeType.isNotEmpty) 'store_type': storeType,
    });
    return _parseList(response.data, (j) => j);
  }

  Future<void> recordSpoilage(Map<String, dynamic> data) async {
    await _dio.post('/wastage', data: data);
  }

  Future<void> updateSpoilageStatus(
      String id, Map<String, dynamic> data) async {
    await _dio.put('/wastage/$id', data: data);
  }

  Future<List<Map<String, dynamic>>> getPackingRecords() async {
    final response = await _dio.get('/store/stock-requests', queryParameters: {
      'status': 'APPROVED',
    });
    return _parseList(response.data, (j) => j);
  }

  Future<Map<String, dynamic>> reviewStockRequest(
    String id, {
    required String action,
    String? reviewNotes,
    List<Map<String, dynamic>>? approvedItems,
  }) async {
    final response = await _dio.put('/store/stock-requests/$id/review', data: {
      'action': action,
      if (reviewNotes != null && reviewNotes.isNotEmpty)
        'review_notes': reviewNotes,
      if (approvedItems != null) 'approved_items': approvedItems,
    });
    return _unwrap(response.data);
  }

  Future<Map<String, dynamic>> createDispatchNote(
      Map<String, dynamic> data) async {
    final response = await _dio.post('/store/dispatch-notes', data: data);
    return _unwrap(response.data);
  }

  Future<void> markDispatched(String id,
      {String? vehicleId, String? driverId}) async {
    await _dio.put('/store/dispatch-notes/$id/dispatch', data: {
      if (vehicleId != null && vehicleId.isNotEmpty) 'vehicle_id': vehicleId,
      if (driverId != null && driverId.isNotEmpty) 'driver_id': driverId,
    });
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

  // -----------------------------------------------------------------------
  // Mobile / Barcode APIs
  // -----------------------------------------------------------------------

  /// Look up a store item by its barcode or SKU.
  /// Returns null when not found (404 treated as null).
  Future<Map<String, dynamic>?> getItemByBarcode(String code) async {
    try {
      final response = await _dio.get(
        '/storekeeping/items',
        queryParameters: {'search': code, 'limit': 5},
      );
      final list = _parseList(response.data, (j) => j);
      if (list.isEmpty) return null;
      // Prefer exact barcode/SKU match before falling back to first result
      final exact = list.firstWhere(
        (item) =>
            (item['barcode'] ?? '').toString().toLowerCase() ==
                code.toLowerCase() ||
            (item['sku'] ?? '').toString().toLowerCase() == code.toLowerCase(),
        orElse: () => list.first,
      );
      return exact;
    } on DioException catch (e) {
      if (e.response?.statusCode == 404) return null;
      rethrow;
    }
  }

  /// List purchase orders (for selecting which PO to GRN against).
  Future<List<Map<String, dynamic>>> getPurchaseOrders({
    String? status,
    String? supplierId,
    String? fromDate,
    String? toDate,
  }) async {
    final response =
        await _dio.get('/procurement/purchase-orders', queryParameters: {
      if (status != null && status.isNotEmpty && status != 'all')
        'status': status,
      if (supplierId != null && supplierId.isNotEmpty)
        'supplier_id': supplierId,
      if (fromDate != null && fromDate.isNotEmpty) 'from_date': fromDate,
      if (toDate != null && toDate.isNotEmpty) 'to_date': toDate,
      'source_module': 'central_store',
      'limit': 100,
    });
    return _parseList(response.data, (j) => j);
  }

  Future<Map<String, dynamic>> getPurchaseOrder(String id) async {
    final response = await _dio.get('/procurement/purchase-orders/$id',
        queryParameters: {'source_module': 'central_store'});
    return _unwrap(response.data);
  }

  Future<Map<String, dynamic>> createPurchaseOrder(
      Map<String, dynamic> data) async {
    final response = await _dio.post('/procurement/purchase-orders', data: {
      ...data,
      'source_module': 'central_store',
    });
    return _unwrap(response.data);
  }

  Future<Map<String, dynamic>> updatePurchaseOrder(
      String id, Map<String, dynamic> data) async {
    final response = await _dio.put('/procurement/purchase-orders/$id', data: {
      ...data,
      'source_module': 'central_store',
    });
    return _unwrap(response.data);
  }

  Future<void> approvePurchaseOrder(String id) async {
    await _dio.put('/procurement/purchase-orders/$id/approve',
        queryParameters: {'source_module': 'central_store'});
  }

  Future<void> cancelPurchaseOrder(String id) async {
    await _dio.put('/procurement/purchase-orders/$id/cancel',
        queryParameters: {'source_module': 'central_store'});
  }

  Future<void> sendPurchaseOrder(String id) async {
    await _dio.post('/procurement/purchase-orders/$id/send',
        queryParameters: {'source_module': 'central_store'});
  }

  /// List Goods Received Notes (for the GRN register cards).
  Future<List<Map<String, dynamic>>> getGrns({String? status}) async {
    final response = await _dio.get('/procurement/grn', queryParameters: {
      if (status != null && status.isNotEmpty && status != 'all')
        'status': status,
    });
    return _parseList(response.data, (j) => j);
  }

  /// Submit a new Goods Receipt Note.
  /// [data] must contain: po_id, supplier_id, items[].
  Future<Map<String, dynamic>> submitGrn(Map<String, dynamic> data) async {
    final response = await _dio.post(
      '/procurement/grn',
      data: data,
      options: Options(
        sendTimeout: const Duration(minutes: 2),
        receiveTimeout: const Duration(minutes: 3),
        extra: const {'disable_retry': true},
      ),
    );
    return _unwrap(response.data);
  }

  /// List stock-take sessions.
  Future<List<Map<String, dynamic>>> getStockTakes({String? status}) async {
    final branchId = await _branchId;
    final response = await _dio.get('/stock-takes', queryParameters: {
      if (branchId.isNotEmpty) 'branch_id': branchId,
      if (status != null) 'status': status,
    });
    return _parseList(response.data, (j) => j);
  }

  /// Submit a finalised stock-take count.
  Future<Map<String, dynamic>> submitStockTake(
      Map<String, dynamic> data) async {
    final response = await _dio.post('/stock-takes', data: data);
    return _unwrap(response.data);
  }

  /// Confirm receipt of a dispatch note (central store receiving from supplier
  /// or branch receiving from central store).
  Future<void> confirmDispatchNote(
      String id, Map<String, dynamic> items) async {
    await _dio.put('/store/dispatch-notes/$id/confirm', data: items);
  }

  /// Branch storekeeper verifies B-XXXX OTP to confirm goods arrival.
  /// Status changes: in_transit → completed.
  Future<Map<String, dynamic>> verifyBranchOtp(
      String dispatchId, String otp) async {
    final response = await _dio.post(
      '/dispatch/dispatches/$dispatchId/verify-branch-otp',
      data: {'branch_otp': otp.trim().toUpperCase()},
    );
    return _unwrap(response.data);
  }

  /// Incoming dispatches (IN_TRANSIT) headed to this branch.
  Future<List<Map<String, dynamic>>> getIncomingDispatches() =>
      getReceivingRecords();
}
