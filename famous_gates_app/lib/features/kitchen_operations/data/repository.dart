import 'dart:io';

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:path_provider/path_provider.dart';

import '../../../core/network/dio_client.dart';
import '../../../core/storage/secure_storage_provider.dart';
import '../../auth/data/auth_repository.dart';

final kitchenOpsRepositoryProvider = Provider<KitchenOpsRepository>((ref) {
  return KitchenOpsRepository(ref.read(dioProvider), ref);
});

class KitchenOpsRepository {
  KitchenOpsRepository(this._dio, this._ref);

  final Dio _dio;
  final Ref _ref;

  Future<String> get _branchId async {
    final storage = _ref.read(secureStorageProvider);
    return await storage.read(key: AuthRepository.branchIdKey) ?? '';
  }

  Future<Map<String, dynamic>> _branchQuery(
      [Map<String, dynamic>? extra]) async {
    final branchId = await _branchId;
    return {
      if (branchId.isNotEmpty) 'branch_id': int.tryParse(branchId) ?? branchId,
      ...?extra,
    };
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

  Future<Map<String, dynamic>> getDashboardStats() async {
    final response = await _dio.get(
      '/kitchen/dashboard/stats',
      queryParameters: await _branchQuery(),
    );
    return _unwrapMap(response.data);
  }

  Future<List<Map<String, dynamic>>> getStock({
    bool lowStock = false,
    String? search,
  }) async {
    final response = await _dio.get(
      '/kitchen/stock',
      queryParameters: await _branchQuery({
        if (lowStock) 'low_stock': 'true',
      }),
    );
    final rows = _unwrapList(response.data);
    if (search == null || search.trim().isEmpty) return rows;
    final needle = search.toLowerCase();
    return rows.where((row) {
      return _text(row, ['item_name', 'name', 'item_sku', 'sku'])
          .toLowerCase()
          .contains(needle);
    }).toList();
  }

  Future<List<Map<String, dynamic>>> getLedger({
    String? transactionType,
    String? itemSku,
    String? startDate,
    String? endDate,
  }) async {
    final response = await _dio.get(
      '/kitchen/stock/ledger',
      queryParameters: await _branchQuery({
        if (transactionType != null && transactionType != 'ALL')
          'transaction_type': transactionType,
        if (itemSku != null && itemSku.isNotEmpty) 'item_sku': itemSku,
        if (startDate != null) 'start_date': startDate,
        if (endDate != null) 'end_date': endDate,
        'limit': 250,
      }),
    );
    return _unwrapList(response.data);
  }

  Future<List<Map<String, dynamic>>> getItemHistory(String sku) async {
    final response = await _dio.get(
      '/kitchen/stock/$sku/history',
      queryParameters: await _branchQuery(),
    );
    return _unwrapList(response.data);
  }

  Future<List<Map<String, dynamic>>> getManualLedger({
    String? status,
    String? itemId,
  }) async {
    final response = await _dio.get(
      '/kitchen-ledger/ledger',
      queryParameters: await _branchQuery({
        if (status != null && status != 'ALL') 'status': status,
        if (itemId != null && itemId.isNotEmpty) 'item_id': itemId,
      }),
    );
    return _unwrapList(response.data);
  }

  Future<void> createManualLedger(Map<String, dynamic> data) async {
    await _dio.post('/kitchen-ledger/ledger', data: {
      ...await _branchQuery(),
      ...data,
    });
  }

  Future<void> updateManualLedger(String id, Map<String, dynamic> data) async {
    await _dio.patch('/kitchen-ledger/ledger/$id', data: data);
  }

  Future<void> updateManualLedgerStatus(String id, String status) async {
    await _dio.patch('/kitchen-ledger/ledger/$id/status', data: {
      'status': status,
    });
  }

  Future<List<Map<String, dynamic>>> getStoreReceipts({
    String? status,
  }) async {
    final response = await _dio.get(
      '/kitchen-ledger/receipts',
      queryParameters: await _branchQuery({
        if (status != null && status != 'ALL') 'status': status,
      }),
    );
    return _unwrapList(response.data);
  }

  Future<void> createStoreReceipt(Map<String, dynamic> data) async {
    await _dio.post('/kitchen-ledger/receipts', data: {
      ...await _branchQuery(),
      ...data,
    });
  }

  Future<void> verifyStoreReceipt(String id, String status) async {
    await _dio.patch('/kitchen-ledger/receipts/$id/verify', data: {
      'status': status,
    });
  }

  Future<List<Map<String, dynamic>>> getPortionTracking({
    String? date,
  }) async {
    final response = await _dio.get(
      '/kitchen-ledger/portion-tracking',
      queryParameters: await _branchQuery({
        if (date != null) 'date': date,
      }),
    );
    return _unwrapList(response.data);
  }

  Future<List<Map<String, dynamic>>> getVarianceLogs({
    String? status,
  }) async {
    final response = await _dio.get(
      '/kitchen-ledger/variance-logs',
      queryParameters: await _branchQuery({
        if (status != null && status != 'ALL') 'status': status,
      }),
    );
    return _unwrapList(response.data);
  }

  Future<void> approveVarianceLog(String id, String status) async {
    await _dio.patch('/kitchen-ledger/variance-logs/$id/approve', data: {
      'status': status,
    });
  }

  Future<List<Map<String, dynamic>>> getStoreItems({
    String? search,
    int limit = 500,
  }) async {
    final response = await _dio.get('/store/items', queryParameters: {
      if (search != null && search.isNotEmpty) 'search': search,
      'limit': limit,
    });
    return _unwrapList(response.data);
  }

  Future<List<Map<String, dynamic>>> getRequisitions({String? status}) async {
    final response = await _dio.get(
      '/kitchen/requisitions',
      queryParameters: await _branchQuery({
        if (status != null && status != 'ALL') 'status': status,
      }),
    );
    return _unwrapList(response.data);
  }

  Future<Map<String, dynamic>> getRequisition(String id) async {
    final response = await _dio.get('/kitchen/requisitions/$id');
    return _unwrapMap(response.data);
  }

  Future<Map<String, dynamic>> getRequisitionRelatedActivity(String id) async {
    final response = await _dio.get('/kitchen/requisitions/$id/related-activity');
    return _unwrapMap(response.data);
  }

  Future<void> createRequisition(Map<String, dynamic> data) async {
    await _dio.post('/kitchen/requisitions', data: data);
  }

  Future<void> approveRequisition(
    String id,
    List<Map<String, dynamic>> approvedQuantities,
  ) async {
    await _dio.put('/kitchen/requisitions/$id/approve', data: {
      'approved_quantities': approvedQuantities,
    });
  }

  Future<void> rejectRequisition(String id, String reason) async {
    await _dio.put('/kitchen/requisitions/$id/reject', data: {
      'rejection_reason': reason,
    });
  }

  Future<void> fulfillRequisition(
    String id,
    List<Map<String, dynamic>> issuedQuantities, {
    String? notes,
  }) async {
    await _dio.post('/kitchen/requisitions/$id/fulfill', data: {
      'issued_quantities': issuedQuantities,
      if (notes != null && notes.isNotEmpty) 'notes': notes,
    });
  }

  Future<List<Map<String, dynamic>>> getRecipes({
    bool activeOnly = false,
  }) async {
    final response = await _dio.get('/kitchen/recipes', queryParameters: {
      if (activeOnly) 'active_only': 'true',
    });
    return _unwrapList(response.data);
  }

  Future<Map<String, dynamic>> getRecipe(String id) async {
    final response = await _dio.get('/kitchen/recipes/$id');
    return _unwrapMap(response.data);
  }

  Future<void> createRecipe(Map<String, dynamic> data) async {
    await _dio.post('/kitchen/recipes', data: data);
  }

  Future<void> updateRecipe(String id, Map<String, dynamic> data) async {
    await _dio.put('/kitchen/recipes/$id', data: data);
  }

  Future<void> deleteRecipe(String id) async {
    await _dio.delete('/kitchen/recipes/$id');
  }

  Future<void> lockRecipe(String id) async {
    await _dio.post('/kitchen/recipes/$id/lock');
  }

  Future<void> unlockRecipe(String id) async {
    await _dio.post('/kitchen/recipes/$id/unlock');
  }

  Future<List<Map<String, dynamic>>> getRecipeHistory(String id) async {
    final response = await _dio.get('/kitchen/recipes/$id/history');
    return _unwrapList(response.data);
  }

  Future<void> autoDeductIngredients(Map<String, dynamic> data) async {
    await _dio.post('/kitchen/recipes/auto-deduct', data: data);
  }

  Future<List<Map<String, dynamic>>> getUsage({
    String? usageType,
    String? startDate,
    String? endDate,
  }) async {
    final response = await _dio.get(
      '/kitchen/usage',
      queryParameters: await _branchQuery({
        if (usageType != null && usageType != 'ALL') 'usage_type': usageType,
        if (startDate != null) 'start_date': startDate,
        if (endDate != null) 'end_date': endDate,
      }),
    );
    return _unwrapList(response.data);
  }

  Future<void> recordUsage(Map<String, dynamic> data) async {
    await _dio.post('/kitchen/usage', data: data);
  }

  Future<void> reviewUsage(String id, String notes) async {
    await _dio.put('/kitchen/usage/$id/review', data: {'notes': notes});
  }

  Future<void> auditUsage(String id, String status, String notes) async {
    await _dio.put('/kitchen/usage/$id/audit', data: {
      'status': status,
      'notes': notes,
    });
  }

  Future<List<Map<String, dynamic>>> getWastage({
    String? reason,
    String? startDate,
    String? endDate,
  }) async {
    final response = await _dio.get(
      '/kitchen/wastage',
      queryParameters: await _branchQuery({
        if (reason != null && reason != 'ALL') 'reason': reason,
        if (startDate != null) 'start_date': startDate,
        if (endDate != null) 'end_date': endDate,
      }),
    );
    return _unwrapList(response.data);
  }

  Future<void> recordWastage(Map<String, dynamic> data) async {
    await _dio.post('/kitchen/wastage', data: data);
  }

  Future<void> updateWastage(String id, Map<String, dynamic> data) async {
    await _dio.put('/kitchen/wastage/$id', data: data);
  }

  Future<void> deleteWastage(String id) async {
    await _dio.delete('/kitchen/wastage/$id');
  }

  Future<void> reviewWastage(String id, String notes) async {
    await _dio.put('/kitchen/wastage/$id/review', data: {'notes': notes});
  }

  Future<void> auditWastage(String id, String status, String notes) async {
    await _dio.put('/kitchen/wastage/$id/audit', data: {
      'status': status,
      'notes': notes,
    });
  }

  Future<List<Map<String, dynamic>>> getFoodControls() async {
    final response = await _dio.get(
      '/kitchen/food-controls',
      queryParameters: await _branchQuery(),
    );
    return _unwrapList(response.data);
  }

  Future<void> createFoodControl(Map<String, dynamic> data) async {
    await _dio.post('/kitchen/food-controls', data: {
      ...await _branchQuery(),
      ...data,
    });
  }

  Future<void> updateFoodControl(String id, Map<String, dynamic> data) async {
    await _dio.put('/kitchen/food-controls/$id', data: data);
  }

  Future<void> deleteFoodControl(String id) async {
    await _dio.delete('/kitchen/food-controls/$id');
  }

  Future<Map<String, dynamic>> calculateYield({
    required String ruleId,
    required double rawInputQuantity,
  }) async {
    final response = await _dio.post('/kitchen/food-controls/calculate', data: {
      'rule_id': ruleId,
      'raw_input_quantity': rawInputQuantity,
    });
    return _unwrapMap(response.data);
  }

  Future<List<Map<String, dynamic>>> getPortionStock() async {
    final response = await _dio.get(
      '/kitchen/portion-stock',
      queryParameters: await _branchQuery(),
    );
    return _unwrapList(response.data);
  }

  Future<List<Map<String, dynamic>>> getPortionLedger({String? itemSku}) async {
    final response = await _dio.get(
      '/kitchen/portion-ledger',
      queryParameters: await _branchQuery({
        if (itemSku != null && itemSku.isNotEmpty) 'item_sku': itemSku,
      }),
    );
    return _unwrapList(response.data);
  }

  Future<List<Map<String, dynamic>>> getVarianceReasons() async {
    final response = await _dio.get('/kitchen/variance-reasons');
    return _unwrapList(response.data);
  }

  Future<List<Map<String, dynamic>>> getVariance({
    String? date,
    String? itemSku,
  }) async {
    final response = await _dio.get(
      '/kitchen/variance',
      queryParameters: await _branchQuery({
        if (date != null) 'date': date,
        if (itemSku != null && itemSku.isNotEmpty) 'item_sku': itemSku,
      }),
    );
    return _unwrapList(response.data);
  }

  Future<List<Map<String, dynamic>>> getExpectedPortions({
    String? status,
  }) async {
    final response = await _dio.get(
      '/kitchen/expected-portions',
      queryParameters: await _branchQuery({
        if (status != null && status != 'ALL') 'status': status,
      }),
    );
    return _unwrapList(response.data);
  }

  Future<void> verifyExpectedPortion(
    String id, {
    required double actualPortions,
    String? notes,
  }) async {
    await _dio.put('/kitchen/expected-portions/$id/verify', data: {
      'actual_portions': actualPortions,
      if (notes != null && notes.isNotEmpty) 'notes': notes,
    });
  }

  Future<void> submitVarianceReason(
    String id, {
    required String reasonId,
    String? notes,
  }) async {
    await _dio.post('/kitchen/variance/$id/reason', data: {
      'reason_id': reasonId,
      if (notes != null && notes.isNotEmpty) 'notes': notes,
    });
  }

  Future<void> approveVariance(
    String id, {
    required String status,
    String? notes,
  }) async {
    await _dio.post('/kitchen/variance/$id/approve', data: {
      'status': status,
      if (notes != null && notes.isNotEmpty) 'notes': notes,
    });
  }

  Future<List<Map<String, dynamic>>> getYieldReport({
    required String startDate,
    required String endDate,
  }) async {
    final response = await _dio.get(
      '/kitchen/reports/yield',
      queryParameters: await _branchQuery({
        'start_date': startDate,
        'end_date': endDate,
      }),
    );
    return _unwrapList(response.data);
  }

  Future<List<Map<String, dynamic>>> getLossReport({
    required String startDate,
    required String endDate,
  }) async {
    final response = await _dio.get(
      '/kitchen/reports/loss',
      queryParameters: await _branchQuery({
        'start_date': startDate,
        'end_date': endDate,
      }),
    );
    return _unwrapList(response.data);
  }

  // ── Kitchen Production Sessions ──────────────────────────────────────────

  Future<List<Map<String, dynamic>>> getProductionSessions({
    String? shiftType,
    String? status,
  }) async {
    final response = await _dio.get(
      '/kitchen/production-sessions',
      queryParameters: await _branchQuery({
        if (shiftType != null && shiftType != 'ALL') 'shift_type': shiftType,
        if (status != null && status != 'ALL') 'status': status,
        'limit': 100,
      }),
    );
    return _unwrapList(response.data);
  }

  Future<Map<String, dynamic>> createProductionSession(
      Map<String, dynamic> data) async {
    final response = await _dio.post(
      '/kitchen/production-sessions',
      data: {...await _branchQuery(), ...data},
    );
    return _unwrapMap(response.data);
  }

  Future<Map<String, dynamic>> completeProductionSession(
      String id, Map<String, dynamic> data) async {
    final response = await _dio.put(
      '/kitchen/production-sessions/$id/complete',
      data: data,
    );
    return _unwrapMap(response.data);
  }

  Future<Map<String, dynamic>> getShiftHandover(String shiftType) async {
    final response = await _dio.get(
      '/kitchen/production-sessions/handover',
      queryParameters: await _branchQuery({'shift_type': shiftType}),
    );
    return _unwrapMap(response.data);
  }

  Future<List<Map<String, dynamic>>> getRecipesWithIngredients() async {
    final response = await _dio.get(
      '/kitchen/production-sessions/recipes',
      queryParameters: await _branchQuery(),
    );
    return _unwrapList(response.data);
  }

  Future<List<Map<String, dynamic>>> getKitchenStaff() async {
    final response = await _dio.get(
      '/staff',
      queryParameters: await _branchQuery({'department': 'kitchen', 'limit': 200}),
    );
    return _unwrapList(response.data);
  }

  // ── Spoilage (wastage linked to session) ─────────────────────────────────

  Future<List<Map<String, dynamic>>> getSpoilage({
    String? sessionId,
    String? status,
  }) async {
    final response = await _dio.get(
      '/kitchen/wastage',
      queryParameters: await _branchQuery({
        'reason': 'SPOILAGE',
        if (sessionId != null && sessionId.isNotEmpty) 'session_id': sessionId,
        if (status != null && status != 'ALL') 'status': status,
      }),
    );
    return _unwrapList(response.data);
  }

  Future<void> recordSpoilage(Map<String, dynamic> data) async {
    await _dio.post('/kitchen/wastage', data: {
      ...await _branchQuery(),
      'reason': 'SPOILAGE',
      ...data,
    });
  }

  Future<List<Map<String, dynamic>>> getAccountabilityReport({
    required String startDate,
    required String endDate,
  }) async {
    final response = await _dio.get(
      '/kitchen/reports/accountability',
      queryParameters: await _branchQuery({
        'start_date': startDate,
        'end_date': endDate,
      }),
    );
    return _unwrapList(response.data);
  }

  Future<File> exportBrandedPdf(
    String reportType, {
    Map<String, dynamic> filters = const {},
  }) async {
    final response = await _dio.post('/reports/generate/async', data: {
      'reportType': reportType,
      'filters': {
        ...await _branchQuery(),
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
      final status = await _dio.get('/reports/jobs/$jobId/status');
      job = _unwrapMap(status.data);
      final state = '${job['status'] ?? ''}'.toLowerCase();
      if (state == 'completed') break;
      if (state == 'failed') {
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
      responseBytes.data ?? const <int>[],
      '${reportType}_${DateTime.now().toIso8601String().split('T').first}.pdf',
    );
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

  String _text(Map<String, dynamic> row, List<String> keys) {
    for (final key in keys) {
      final value = row[key];
      if (value != null && '$value'.trim().isNotEmpty) return '$value';
    }
    return '';
  }
}
