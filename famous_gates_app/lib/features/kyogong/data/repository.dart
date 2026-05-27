import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/network/dio_client.dart';

final kyogongRepositoryProvider = Provider<KyogongRepository>((ref) {
  return KyogongRepository(ref.read(dioProvider));
});

class KyogongRepository {
  final Dio _dio;
  KyogongRepository(this._dio);

  Future<List<Map<String, dynamic>>> getSalesPoints({bool? isActive}) async {
    return _getList('/kyogong/sales-points', query: {
      if (isActive != null) 'is_active': isActive,
    });
  }

  Future<Map<String, dynamic>> getSalesPointDetails(String id) async {
    return _getMap('/kyogong/sales-points/$id');
  }

  Future<Map<String, dynamic>> getCurrentShift() async {
    return _getMap('/kyogong/shifts/current');
  }

  Future<List<Map<String, dynamic>>> getShifts({
    String? status,
    String? salesPointId,
    String? startDate,
    String? endDate,
  }) async {
    return _getList('/kyogong/shifts', query: {
      if (status != null && status != 'all') 'status': status,
      if (salesPointId != null && salesPointId.isNotEmpty)
        'sales_point_id': salesPointId,
      if (startDate != null) 'start_date': startDate,
      if (endDate != null) 'end_date': endDate,
    });
  }

  Future<Map<String, dynamic>> getShiftDetails(String id) async {
    return _getMap('/kyogong/shifts/$id');
  }

  Future<Map<String, dynamic>> openShift(Map<String, dynamic> body) async {
    return _postMap('/kyogong/shifts/open', body);
  }

  Future<Map<String, dynamic>> closeShift(
      String id, Map<String, dynamic> body) async {
    return _putMap('/kyogong/shifts/$id/close', body);
  }

  Future<Map<String, dynamic>> recalculateShift(String id) async {
    return _postMap('/kyogong/shifts/$id/recalculate', {});
  }

  Future<Map<String, dynamic>> reconcileShift(
      String id, Map<String, dynamic> body) async {
    return _putMap('/kyogong/shifts/$id/reconcile', body);
  }

  Future<Map<String, dynamic>> approveShift(
      String id, Map<String, dynamic> body) async {
    return _putMap('/kyogong/shifts/$id/approve', body);
  }

  Future<Map<String, dynamic>> flagShift(
      String id, Map<String, dynamic> body) async {
    return _putMap('/kyogong/shifts/$id/flag', body);
  }

  Future<List<Map<String, dynamic>>> getPettyCashEntries(
      {String? shiftId,
      String? startDate,
      String? endDate,
      String? category}) async {
    return _getList('/kyogong/petty-cash', query: {
      if (shiftId != null) 'shift_id': shiftId,
      if (startDate != null) 'start_date': startDate,
      if (endDate != null) 'end_date': endDate,
      if (category != null) 'purpose_category': category,
    });
  }

  Future<Map<String, dynamic>> getPettyCashSummary(
      {String? shiftId, String? startDate, String? endDate}) async {
    return _getMap('/kyogong/petty-cash/summary', query: {
      if (shiftId != null) 'shift_id': shiftId,
      if (startDate != null) 'start_date': startDate,
      if (endDate != null) 'end_date': endDate,
    });
  }

  Future<List<Map<String, dynamic>>> getPettyCashCategories() async {
    return _getList('/kyogong/petty-cash/categories');
  }

  Future<Map<String, dynamic>> recordPettyCash(
      Map<String, dynamic> entry) async {
    return _postMap('/kyogong/petty-cash', entry);
  }

  Future<Map<String, dynamic>> getCurrentFloat(String shiftId) async {
    return _getMap('/kyogong/shifts/$shiftId/float');
  }

  Future<List<Map<String, dynamic>>> getFloatHistory(String shiftId) async {
    return _getList('/kyogong/shifts/$shiftId/float/history');
  }

  Future<Map<String, dynamic>> adjustFloat(
      String shiftId, double adjustmentAmount, String reason) async {
    return _postMap('/kyogong/shifts/$shiftId/float/adjust', {
      'adjustment_amount': adjustmentAmount,
      'adjustmentAmount': adjustmentAmount,
      'reason': reason,
    });
  }

  Future<List<Map<String, dynamic>>> getSpaServices(
          {String? categoryId, bool? isActive}) async =>
      _getList('/kyogong/spa-services', query: {
        if (categoryId != null) 'category_id': categoryId,
        if (isActive != null) 'is_active': isActive,
      });

  Future<List<Map<String, dynamic>>> getServiceCategories() async =>
      _getList('/kyogong/spa-services/categories');

  Future<List<Map<String, dynamic>>> getDynamicServices({
    String? serviceType,
    bool? isActive,
  }) async =>
      _getList('/kyogong/dynamic-services', query: {
        if (serviceType != null) 'service_type': serviceType,
        if (isActive != null) 'is_active': isActive,
      });

  Future<Map<String, dynamic>> createDynamicService(
      Map<String, dynamic> body) async {
    return _postMap('/kyogong/dynamic-services', body);
  }

  Future<Map<String, dynamic>> updateDynamicService(
      String id, Map<String, dynamic> body) async {
    return _putMap('/kyogong/dynamic-services/$id', body);
  }

  Future<List<Map<String, dynamic>>> getShiftTransactions(
          String shiftId) async =>
      _getList('/kyogong/shifts/$shiftId/transactions');

  Future<Map<String, dynamic>> createTransaction(
      String shiftId, Map<String, dynamic> body) async {
    return _postMap('/kyogong/shifts/$shiftId/transactions', body);
  }

  Future<Map<String, dynamic>> getTransactionDetails(String id) async {
    return _getMap('/kyogong/transactions/$id');
  }

  Future<Map<String, dynamic>> voidTransaction(
      String id, Map<String, dynamic> body) async {
    return _putMap('/kyogong/transactions/$id/void', body);
  }

  Future<List<Map<String, dynamic>>> getPoolTokensInventory() async {
    return _getList('/kyogong/pool-tokens');
  }

  Future<Map<String, dynamic>> _getMap(String path,
      {Map<String, dynamic>? query}) async {
    final res = await _dio.get(path, queryParameters: query);
    final data = res.data;
    return data is Map<String, dynamic>
        ? data
        : (data is Map ? Map<String, dynamic>.from(data) : {});
  }

  Future<Map<String, dynamic>> _postMap(String path, Object body) async {
    final res = await _dio.post(path, data: body);
    return _asMap(res.data);
  }

  Future<Map<String, dynamic>> _putMap(String path, Object body) async {
    final res = await _dio.put(path, data: body);
    return _asMap(res.data);
  }

  Future<List<Map<String, dynamic>>> _getList(String path,
      {Map<String, dynamic>? query}) async {
    final res = await _dio.get(path, queryParameters: query);
    final data = res.data;
    final list = data is List
        ? data
        : (data is Map ? (data['data'] ?? data['items'] ?? []) : []);
    return (list as List)
        .whereType<Map>()
        .map((e) => Map<String, dynamic>.from(e))
        .toList();
  }

  Map<String, dynamic> _asMap(dynamic value) {
    return value is Map<String, dynamic>
        ? value
        : (value is Map ? Map<String, dynamic>.from(value) : {});
  }
}
