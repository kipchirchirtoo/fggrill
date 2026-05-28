import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/network/dio_client.dart';

final superAdminMobileRepositoryProvider =
    Provider<SuperAdminMobileRepository>((ref) {
  return SuperAdminMobileRepository(ref.read(dioProvider));
});

class SuperAdminMobileRepository {
  SuperAdminMobileRepository(this._dio);

  final Dio _dio;

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  List<Map<String, dynamic>> _list(dynamic data) {
    final list = data is List
        ? data
        : (data is Map
            ? (data['data'] ?? data['items'] ?? data['rows'] ?? data['results'] ?? [])
            : []);
    return (list as List)
        .whereType<Map>()
        .map((e) => Map<String, dynamic>.from(e))
        .toList();
  }

  Map<String, dynamic> _map(dynamic data) {
    if (data is Map<String, dynamic>) return data;
    if (data is Map) return Map<String, dynamic>.from(data);
    if (data is Map && data['data'] is Map) {
      return Map<String, dynamic>.from(data['data']);
    }
    return <String, dynamic>{};
  }

  // ---------------------------------------------------------------------------
  // System
  // ---------------------------------------------------------------------------

  Future<Map<String, dynamic>> getSystemHealth() async {
    try {
      final res = await _dio.get('/system/health');
      return _map(res.data);
    } catch (_) {
      return {'status': 'unknown'};
    }
  }

  Future<Map<String, dynamic>> getSystemStats() async {
    try {
      final res = await _dio.get('/system/stats');
      return _map(res.data);
    } catch (_) {
      return {};
    }
  }

  // ---------------------------------------------------------------------------
  // Users
  // ---------------------------------------------------------------------------

  Future<List<Map<String, dynamic>>> getUsers({String? search}) async {
    final res = await _dio.get('/system/users', queryParameters: {
      if (search != null && search.isNotEmpty) 'search': search,
    });
    return _list(res.data);
  }

  // ---------------------------------------------------------------------------
  // Audit Logs
  // ---------------------------------------------------------------------------

  Future<List<Map<String, dynamic>>> getAuditLogs({String? severity}) async {
    final res = await _dio.get('/audit-logs', queryParameters: {
      if (severity != null && severity.isNotEmpty) 'severity': severity,
      'limit': 50,
    });
    return _list(res.data);
  }

  // ---------------------------------------------------------------------------
  // Branches
  // ---------------------------------------------------------------------------

  Future<List<Map<String, dynamic>>> getBranches() async {
    final res = await _dio.get('/branches');
    return _list(res.data);
  }
}
