import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/network/dio_client.dart';
import '../domain/models.dart';

final procurementRepositoryProvider = Provider<ProcurementRepository>((ref) {
  return ProcurementRepository(ref.read(dioProvider));
});

class ProcurementRepository {
  final Dio _dio;
  ProcurementRepository(this._dio);

  List<T> _parseList<T>(
      dynamic data, T Function(Map<String, dynamic>) fromJson) {
    final list =
        data is List ? data : (data is Map ? (data['data'] ?? []) : []);
    return (list as List)
        .whereType<Map>()
        .map((json) => fromJson(Map<String, dynamic>.from(json)))
        .toList();
  }

  Future<List<ProcurementItem>> getProcurements() async {
    final response = await _dio.get('/procurement');
    return _parseList(response.data, ProcurementItem.fromJson);
  }

  Future<void> createProcurement(Map<String, dynamic> data) async {
    await _dio.post('/procurement', data: data);
  }

  Future<List<ProcurementSupplier>> getSuppliers() async {
    final response = await _dio.get('/procurement/suppliers');
    return _parseList(response.data, ProcurementSupplier.fromJson);
  }

  Future<List<PurchaseOrder>> getPurchaseOrders({int? limit}) async {
    final response =
        await _dio.get('/procurement/purchase-orders', queryParameters: {
      if (limit != null) 'limit': limit,
    });
    return _parseList(response.data, PurchaseOrder.fromJson);
  }

  Future<List<Map<String, dynamic>>> getGrni() async {
    final response = await _dio
        .get('/procurement/reports/grni', queryParameters: {'status': 'open'});
    return _parseMaps(response.data);
  }

  Future<List<Map<String, dynamic>>> getInvoices({String? status}) async {
    final response = await _dio.get('/procurement/invoices', queryParameters: {
      if (status != null) 'status': status,
    });
    return _parseMaps(response.data);
  }

  Future<List<Map<String, dynamic>>> getAging() async {
    final response = await _dio.get('/procurement/reports/aging');
    return _parseMaps(response.data);
  }

  List<Map<String, dynamic>> _parseMaps(dynamic data) {
    final list = data is List
        ? data
        : (data is Map
            ? (data['data'] ?? data['items'] ?? data['rows'] ?? [])
            : []);
    return (list as List)
        .whereType<Map>()
        .map((e) => Map<String, dynamic>.from(e))
        .toList();
  }
}
