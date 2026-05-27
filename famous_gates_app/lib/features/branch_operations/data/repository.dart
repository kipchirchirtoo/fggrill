import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/network/dio_client.dart';

final branchOperationsRepositoryProvider =
    Provider<BranchOperationsRepository>((ref) {
  return BranchOperationsRepository(ref.read(dioProvider));
});

class BranchOperationsRepository {
  final Dio _dio;
  BranchOperationsRepository(this._dio);

  Future<List<Map<String, dynamic>>> getReservations(
      {String? status, String? from, String? to}) async {
    final res =
        await _dio.get('/branch-operations/reservations', queryParameters: {
      if (status != null) 'status': status,
      if (from != null) 'from': from,
      if (to != null) 'to': to,
    });
    final data = res.data;
    final list =
        data is List ? data : (data is Map ? (data['data'] ?? []) : []);
    return (list as List)
        .whereType<Map>()
        .map((e) => Map<String, dynamic>.from(e))
        .toList();
  }

  Future<Map<String, dynamic>> getDashboard() async {
    final res = await _dio.get('/branch-operations/dashboard');
    final data = res.data;
    return data is Map<String, dynamic>
        ? data
        : (data is Map ? Map<String, dynamic>.from(data) : {});
  }

  Future<List<Map<String, dynamic>>> getInventory() async {
    final res = await _dio.get('/branch-operations/inventory');
    final data = res.data;
    final list =
        data is List ? data : (data is Map ? (data['data'] ?? []) : []);
    return (list as List)
        .whereType<Map>()
        .map((e) => Map<String, dynamic>.from(e))
        .toList();
  }

  Future<List<Map<String, dynamic>>> getIncomingDispatches() async {
    final res = await _dio.get('/branch-operations/inventory/incoming');
    final data = res.data;
    final list =
        data is List ? data : (data is Map ? (data['data'] ?? []) : []);
    return (list as List)
        .whereType<Map>()
        .map((e) => Map<String, dynamic>.from(e))
        .toList();
  }

  Future<List<Map<String, dynamic>>> getStockTakes({String? status}) async {
    final res = await _dio
        .get('/branch-operations/inventory/stock-takes', queryParameters: {
      if (status != null) 'status': status,
    });
    final data = res.data;
    final list =
        data is List ? data : (data is Map ? (data['data'] ?? []) : []);
    return (list as List)
        .whereType<Map>()
        .map((e) => Map<String, dynamic>.from(e))
        .toList();
  }

  Future<Map<String, dynamic>> createStockTake(
      Map<String, dynamic> body) async {
    final res =
        await _dio.post('/branch-operations/inventory/stock-takes', data: body);
    final data = res.data;
    return data is Map<String, dynamic>
        ? data
        : (data is Map ? Map<String, dynamic>.from(data) : {});
  }

  Future<List<Map<String, dynamic>>> getStaff() async {
    final res = await _dio.get('/branch-operations/staff');
    final data = res.data;
    final list =
        data is List ? data : (data is Map ? (data['data'] ?? []) : []);
    return (list as List)
        .whereType<Map>()
        .map((e) => Map<String, dynamic>.from(e))
        .toList();
  }

  Future<List<Map<String, dynamic>>> getRooms() async =>
      _getList('/branch-operations/rooms');
  Future<List<Map<String, dynamic>>> getCommunications() async =>
      _getList('/branch-operations/communications');

  Future<List<Map<String, dynamic>>> _getList(String path) async {
    final res = await _dio.get(path);
    final data = res.data;
    final list = data is List
        ? data
        : (data is Map ? (data['data'] ?? data['items'] ?? []) : []);
    return (list as List)
        .whereType<Map>()
        .map((e) => Map<String, dynamic>.from(e))
        .toList();
  }
}
