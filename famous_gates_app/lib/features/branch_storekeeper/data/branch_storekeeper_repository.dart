import 'dart:io';

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:path_provider/path_provider.dart';

import '../../../core/network/dio_client.dart';
import '../../../core/storage/secure_storage_provider.dart';
import '../../auth/data/auth_repository.dart';

final branchStorekeeperRepositoryProvider =
    Provider<BranchStorekeeperRepository>((ref) {
  return BranchStorekeeperRepository(ref.read(dioProvider), ref);
});

class BranchStorekeeperRepository {
  BranchStorekeeperRepository(this._dio, this._ref);

  final Dio _dio;
  final Ref _ref;

  Future<String> get _branchId async {
    final storage = _ref.read(secureStorageProvider);
    return await storage.read(key: AuthRepository.branchIdKey) ?? '';
  }

  Map<String, dynamic> _map(dynamic data) {
    if (data is Map<String, dynamic>) return data;
    if (data is Map) return Map<String, dynamic>.from(data);
    return <String, dynamic>{};
  }

  Map<String, dynamic> _unwrapMap(dynamic data) {
    final raw = _map(data);
    final payload = raw['data'];
    if (payload is Map) return Map<String, dynamic>.from(payload);
    return raw;
  }

  List<Map<String, dynamic>> _unwrapList(dynamic data) {
    final raw = data is Map ? data : null;
    final payload = raw == null
        ? data
        : raw['data'] ?? raw['items'] ?? raw['rows'] ?? raw['results'];
    if (payload is List) {
      return payload
          .whereType<Map>()
          .map((item) => Map<String, dynamic>.from(item))
          .toList();
    }
    if (payload is Map) return [Map<String, dynamic>.from(payload)];
    return <Map<String, dynamic>>[];
  }

  Future<Map<String, dynamic>> _branchQuery(
      [Map<String, dynamic>? extra]) async {
    final branchId = await _branchId;
    return {
      if (branchId.isNotEmpty) 'branch_id': branchId,
      ...?extra,
    };
  }

  Future<Map<String, dynamic>> dashboard() async {
    final response = await _dio.get(
      '/store/dashboard/branch',
      queryParameters: await _branchQuery(),
    );
    return _unwrapMap(response.data);
  }

  Future<List<Map<String, dynamic>>> branchStock({
    String? search,
    String? category,
  }) async {
    final response = await _dio.get(
      '/store/branch-stock',
      queryParameters: await _branchQuery({
        if (search != null && search.isNotEmpty) 'search': search,
        if (category != null && category != 'all') 'category': category,
      }),
    );
    return _unwrapList(response.data);
  }

  Future<List<Map<String, dynamic>>> lowStock() async {
    final response = await _dio.get(
      '/store/branch-stock/low',
      queryParameters: await _branchQuery(),
    );
    return _unwrapList(response.data);
  }

  Future<List<Map<String, dynamic>>> masterCatalog({
    String? search,
    String? category,
    int limit = 500,
  }) async {
    final response = await _dio.get('/store/master-catalog', queryParameters: {
      if (search != null && search.isNotEmpty) 'search': search,
      if (category != null && category != 'all') 'category': category,
      'limit': limit,
    });
    return _unwrapList(response.data);
  }

  Future<List<Map<String, dynamic>>> storeItems({
    String? search,
    int limit = 500,
  }) async {
    final response = await _dio.get('/store/items', queryParameters: {
      if (search != null && search.isNotEmpty) 'search': search,
      'limit': limit,
    });
    return _unwrapList(response.data);
  }

  Future<void> createItem(Map<String, dynamic> data) async {
    await _dio.post('/store/items', data: data);
  }

  Future<void> adjustBranchStock(Map<String, dynamic> data) async {
    await _dio.post('/store/branch-stock/adjustment', data: {
      ...data,
      ...await _branchQuery(),
    });
  }

  Future<void> recordStockOut(Map<String, dynamic> data) async {
    await _dio.post('/store/branch-stock/out', data: {
      ...data,
      ...await _branchQuery(),
    });
  }

  Future<List<Map<String, dynamic>>> stockMovements({
    String? movementType,
  }) async {
    final response = await _dio.get(
      '/store/stock-movements',
      queryParameters: await _branchQuery({
        if (movementType != null) 'movement_type': movementType,
      }),
    );
    return _unwrapList(response.data);
  }

  Future<List<Map<String, dynamic>>> incomingDispatches() async {
    final response = await _dio.get(
      '/store/incoming-dispatches',
      queryParameters: await _branchQuery(),
    );
    return _unwrapList(response.data);
  }

  Future<void> confirmDispatch(String dispatchId, Map<String, dynamic> data) {
    return _dio.put('/store/dispatch-notes/$dispatchId/confirm', data: data);
  }

  Future<void> receiveFromSupplier(Map<String, dynamic> data) async {
    await _dio.post('/store/branch-stock/receive-supplier', data: {
      ...data,
      ...await _branchQuery(),
    });
  }

  Future<List<Map<String, dynamic>>> suppliers({
    String scope = 'branch',
    String? status,
    String? search,
  }) async {
    final response = await _dio.get('/store/suppliers', queryParameters: {
      'scope': scope,
      if (status != null && status != 'ALL') 'status': status,
      if (search != null && search.isNotEmpty) 'search': search,
    });
    return _unwrapList(response.data);
  }

  Future<void> createSupplier(Map<String, dynamic> data) async {
    await _dio.post('/store/suppliers', data: data);
  }

  Future<void> updateSupplier(String id, Map<String, dynamic> data) async {
    await _dio.put('/store/suppliers/$id', data: data);
  }

  Future<void> deleteSupplier(String id) async {
    await _dio.delete('/store/suppliers/$id');
  }

  Future<List<Map<String, dynamic>>> stockTakes({
    String storeType = 'all',
  }) async {
    final response = await _dio.get(
      '/stock-takes',
      queryParameters: await _branchQuery({
        if (storeType != 'all') 'store_type': storeType,
      }),
    );
    return _unwrapList(response.data);
  }

  Future<Map<String, dynamic>> createStockTake({
    String countType = 'daily',
    String storeType = 'foodstuffs',
    String? outletCode,
  }) async {
    final response = await _dio.post('/stock-takes', data: {
      ...await _branchQuery(),
      'count_type': countType,
      'store_type': storeType,
      if (outletCode != null && outletCode.isNotEmpty)
        'outlet_code': outletCode,
    });
    return _unwrapMap(response.data);
  }

  Future<Map<String, dynamic>> stockTake(String id) async {
    final response = await _dio.get('/stock-takes/$id');
    return _unwrapMap(response.data);
  }

  Future<List<Map<String, dynamic>>> stockTakeItems(String id) async {
    final response = await _dio.get('/stock-takes/$id/items');
    return _unwrapList(response.data);
  }

  Future<void> updateStockTake(String id, List<Map<String, dynamic>> items) {
    return _dio.put('/stock-takes/$id', data: {'items': items});
  }

  Future<void> updateStockTakeItem(
    String itemId,
    Map<String, dynamic> data,
  ) {
    return _dio.put('/store/stock-take-items/$itemId', data: data);
  }

  Future<void> completeStockTake(String id, {String? notes}) {
    return _dio.post('/stock-takes/$id/submit', data: {
      if (notes != null && notes.isNotEmpty) 'notes': notes,
    });
  }

  Future<File> downloadStockTakeWorksheet({
    String? id,
    String? category,
  }) async {
    final endpoint =
        id == null ? '/stock-takes/worksheet' : '/stock-takes/$id/worksheet';
    final query = await _branchQuery({
      if (category != null && category != 'all') 'category': category,
    });
    return _downloadGet(
      endpoint,
      filename: 'StockTakeWorksheet_${id ?? 'All'}_${_today()}.pdf',
      queryParameters: query,
    );
  }

  Future<File> downloadCategorizedStockTakeWorksheet(String id) {
    return _downloadGet(
      '/stock-takes/$id/worksheet-categorized',
      filename: 'StockTakeWorksheet_${id}_${_today()}.pdf',
    );
  }

  Future<List<Map<String, dynamic>>> purchaseOrders({
    String? status,
  }) async {
    final response = await _dio.get('/store/purchase-orders', queryParameters: {
      'source_module': 'branch_store',
      if (status != null && status != 'ALL') 'status': status,
    });
    return _unwrapList(response.data);
  }

  Future<void> createPurchaseOrder(Map<String, dynamic> data) async {
    await _dio.post(
      '/store/purchase-orders',
      queryParameters: {'source_module': 'branch_store'},
      data: data,
    );
  }

  Future<void> updatePurchaseOrder(String id, Map<String, dynamic> data) async {
    await _dio.put(
      '/store/purchase-orders/$id',
      queryParameters: {'source_module': 'branch_store'},
      data: data,
    );
  }

  Future<void> deletePurchaseOrder(String id) async {
    await _dio.delete(
      '/store/purchase-orders/$id',
      queryParameters: {'source_module': 'branch_store'},
    );
  }

  Future<void> approvePurchaseOrder(String id) async {
    await _dio.post(
      '/store/purchase-orders/$id/approve',
      queryParameters: {'source_module': 'branch_store'},
    );
  }

  Future<void> receivePurchaseOrder(String id) async {
    await _dio.post(
      '/store/purchase-orders/$id/receive',
      queryParameters: {'source_module': 'branch_store'},
    );
  }

  Future<void> cancelPurchaseOrder(String id) async {
    await _dio.post(
      '/store/purchase-orders/$id/cancel',
      queryParameters: {'source_module': 'branch_store'},
    );
  }

  Future<List<Map<String, dynamic>>> stockRequests({String? status}) async {
    final response = await _dio.get(
      '/store/stock-requests',
      queryParameters: await _branchQuery({
        if (status != null && status != 'ALL') 'status': status,
      }),
    );
    return _unwrapList(response.data);
  }

  Future<void> createStockRequest(Map<String, dynamic> data) async {
    final branchId = await _branchId;
    await _dio.post('/store/stock-requests', data: {
      ...data,
      if (branchId.isNotEmpty) 'requesting_branch_id': int.tryParse(branchId),
    });
  }

  Future<List<Map<String, dynamic>>> kitchenRequisitions({
    String? status,
  }) async {
    final response = await _dio.get('/kitchen/requisitions', queryParameters: {
      ...await _branchQuery(),
      if (status != null && status != 'ALL') 'status': status,
    });
    return _unwrapList(response.data);
  }

  Future<void> fulfillKitchenRequisition(
    String id,
    List<Map<String, dynamic>> issuedQuantities,
  ) async {
    await _dio.post('/kitchen/requisitions/$id/fulfill', data: {
      'issued_quantities': issuedQuantities,
    });
  }

  Future<void> rejectKitchenRequisition(String id, String reason) async {
    await _dio.post('/kitchen/requisitions/$id/reject', data: {
      'reason': reason,
      'rejection_reason': reason,
    });
  }

  Future<List<Map<String, dynamic>>> trackableItems() async {
    final response = await _dio.get(
      '/store/kitchen-usage/trackable-items',
      queryParameters: await _branchQuery(),
    );
    return _unwrapList(response.data);
  }

  Future<List<Map<String, dynamic>>> kitchenUsageRecords({
    String? status,
  }) async {
    final response = await _dio.get(
      '/store/kitchen-usage',
      queryParameters: await _branchQuery({
        if (status != null && status != 'ALL') 'status': status,
      }),
    );
    return _unwrapList(response.data);
  }

  Future<void> createKitchenUsageRecord(Map<String, dynamic> data) async {
    await _dio.post('/store/kitchen-usage', data: {
      ...data,
      ...await _branchQuery(),
    });
  }

  Future<List<Map<String, dynamic>>> kitchenUsageEntries(String id) async {
    final response = await _dio.get('/store/kitchen-usage/$id/entries');
    return _unwrapList(response.data);
  }

  Future<void> addKitchenUsageEntry(
      String id, Map<String, dynamic> data) async {
    await _dio.post('/store/kitchen-usage/$id/entries', data: data);
  }

  Future<void> closeKitchenUsageRecord(
      String id, Map<String, dynamic> data) async {
    await _dio.put('/store/kitchen-usage/$id/close', data: data);
  }

  Future<List<Map<String, dynamic>>> branchStaff() async {
    final response = await _dio.get(
      '/store/kitchen-usage/staff',
      queryParameters: await _branchQuery(),
    );
    return _unwrapList(response.data);
  }

  Future<List<Map<String, dynamic>>> kitchenAccountability({
    String? startDate,
    String? endDate,
  }) async {
    final response = await _dio.get(
      '/store/kitchen-usage/accountability',
      queryParameters: await _branchQuery({
        if (startDate != null) 'start_date': startDate,
        if (endDate != null) 'end_date': endDate,
      }),
    );
    return _unwrapList(response.data);
  }

  Future<Map<String, dynamic>> kitchenUsageSummary({
    String? startDate,
    String? endDate,
  }) async {
    final response = await _dio.get(
      '/store/kitchen-usage/summary',
      queryParameters: await _branchQuery({
        if (startDate != null) 'start_date': startDate,
        if (endDate != null) 'end_date': endDate,
      }),
    );
    return _unwrapMap(response.data);
  }

  Future<File> exportStockLedger({
    String? startDate,
    String? endDate,
  }) async {
    final branchId = await _branchId;
    return _downloadPost(
      '/store/stock-ledger/export',
      filename: 'stock_ledger_${_today()}.xlsx',
      data: {
        if (branchId.isNotEmpty)
          'branch_id': int.tryParse(branchId) ?? branchId,
        if (startDate != null) 'start_date': startDate,
        if (endDate != null) 'end_date': endDate,
      },
    );
  }

  Future<File> exportBrandedPdf(
    String reportType, {
    Map<String, dynamic> filters = const {},
  }) async {
    final branchId = await _branchId;
    final response = await _dio.post('/reports/generate/async', data: {
      'reportType': reportType,
      'filters': {
        if (branchId.isNotEmpty)
          'branch_id': int.tryParse(branchId) ?? branchId,
        ...filters,
      },
      'useRealData': true,
    });
    final init = _unwrapMap(response.data);
    final jobId = init['jobId'] ?? init['id'];
    if (jobId == null || '$jobId'.isEmpty) {
      throw StateError('Report generation did not return a job id');
    }

    Map<String, dynamic> job = {};
    for (var attempt = 0; attempt < 60; attempt++) {
      await Future<void>.delayed(const Duration(seconds: 2));
      final statusResponse = await _dio.get('/reports/jobs/$jobId/status');
      job = _unwrapMap(statusResponse.data);
      final status = '${job['status'] ?? ''}'.toLowerCase();
      if (status == 'completed') break;
      if (status == 'failed') {
        throw StateError('${job['error'] ?? 'Report generation failed'}');
      }
    }

    final resultUrl = job['result_url'] ?? job['resultUrl'] ?? job['url'];
    if (resultUrl == null || '$resultUrl'.isEmpty) {
      throw StateError('Generated report is missing a download URL');
    }

    final url = '$resultUrl';
    final responseBytes = url.startsWith('http')
        ? await Dio().get<List<int>>(
            url,
            options: Options(responseType: ResponseType.bytes),
          )
        : await _dio.get<List<int>>(
            url,
            options: Options(responseType: ResponseType.bytes),
          );
    return _saveBytes(
        responseBytes.data ?? const <int>[], '${reportType}_${_today()}.pdf');
  }

  Future<File> _downloadGet(
    String endpoint, {
    required String filename,
    Map<String, dynamic> queryParameters = const {},
  }) async {
    final response = await _dio.get<List<int>>(
      endpoint,
      queryParameters: queryParameters,
      options: Options(responseType: ResponseType.bytes),
    );
    return _saveBytes(response.data ?? const <int>[], filename);
  }

  Future<File> _downloadPost(
    String endpoint, {
    required String filename,
    Map<String, dynamic> data = const {},
  }) async {
    final response = await _dio.post<List<int>>(
      endpoint,
      data: data,
      options: Options(responseType: ResponseType.bytes),
    );
    return _saveBytes(response.data ?? const <int>[], filename);
  }

  Future<File> _saveBytes(List<int> bytes, String filename) async {
    if (bytes.isEmpty) throw StateError('Downloaded file was empty');
    final directory = await getDownloadsDirectory() ??
        await getApplicationDocumentsDirectory();
    final safeName = filename.replaceAll(RegExp(r'[^A-Za-z0-9._-]'), '_');
    final file = File('${directory.path}/$safeName');
    await file.writeAsBytes(bytes, flush: true);
    return file;
  }

  String _today() => DateTime.now().toIso8601String().split('T').first;
}
