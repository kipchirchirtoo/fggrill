import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/network/dio_client.dart';

final gmRepositoryProvider = Provider<GMRepository>((ref) {
  return GMRepository(ref.read(dioProvider));
});

class GMRepository {
  final Dio _dio;
  GMRepository(this._dio);

  Future<Map<String, dynamic>> getOverview() async {
    final res = await _dio.get('/finance/dashboard');
    final data = res.data;
    return data is Map<String, dynamic>
        ? data
        : (data is Map ? Map<String, dynamic>.from(data) : {});
  }

  Future<List<Map<String, dynamic>>> getBranches() async {
    final res = await _dio.get('/branches');
    final data = res.data;
    final list =
        data is List ? data : (data is Map ? (data['data'] ?? []) : []);
    return (list as List)
        .whereType<Map>()
        .map((e) => Map<String, dynamic>.from(e))
        .toList();
  }

  Future<List<Map<String, dynamic>>> getStaff() => _getList('/staff');
  Future<List<Map<String, dynamic>>> getLeaveRequests() =>
      _getList('/staff/leave-requests', {'status': 'pending'});
  Future<List<Map<String, dynamic>>> getBranchFinancials() =>
      _getList('/finance/branches');

  Future<List<Map<String, dynamic>>> _getList(String path,
      [Map<String, dynamic>? query]) async {
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
}
