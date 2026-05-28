import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/network/dio_client.dart';

final gmRepositoryProvider = Provider<GMRepository>((ref) {
  return GMRepository(ref.read(dioProvider));
});

class GMRepository {
  final Dio _dio;
  GMRepository(this._dio);

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  Map<String, dynamic> _asMap(dynamic data) {
    if (data is Map<String, dynamic>) return data;
    if (data is Map) return Map<String, dynamic>.from(data);
    return <String, dynamic>{};
  }

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

  // ---------------------------------------------------------------------------
  // Dashboard
  // ---------------------------------------------------------------------------

  Future<Map<String, dynamic>> getOverview() async {
    final res = await _dio.get('/finance/dashboard');
    return _asMap(res.data);
  }

  Future<List<Map<String, dynamic>>> getBranches() =>
      _getList('/branches');

  Future<List<Map<String, dynamic>>> getStaff() => _getList('/staff');

  Future<List<Map<String, dynamic>>> getLeaveRequests(
          {String status = 'pending'}) =>
      _getList('/staff/leave-requests', {'status': status});

  Future<List<Map<String, dynamic>>> getBranchFinancials() =>
      _getList('/finance/branches');

  // ---------------------------------------------------------------------------
  // Leave management
  // ---------------------------------------------------------------------------

  Future<void> approveLeave(String id, {String? notes}) async {
    await _dio.put('/staff/leave-requests/$id/approve', data: {
      if (notes != null && notes.trim().isNotEmpty) 'notes': notes.trim(),
    });
  }

  Future<void> rejectLeave(String id, {String? reason}) async {
    await _dio.put('/staff/leave-requests/$id/reject', data: {
      if (reason != null && reason.trim().isNotEmpty) 'reason': reason.trim(),
    });
  }
}
