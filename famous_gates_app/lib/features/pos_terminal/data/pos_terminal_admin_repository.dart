import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/dio_client.dart';

/// Admin-side API for POS terminal management (SuperAdmin/Director/GM).
/// Distinct from PosTerminalService, which is the device-side enrollment/auth.
class PosTerminalAdminRepository {
  PosTerminalAdminRepository(this._dio);

  final Dio _dio;

  List<Map<String, dynamic>> _list(dynamic data) {
    final payload = data is Map ? data['data'] : data;
    if (payload is List) {
      return payload.whereType<Map>().map((e) => Map<String, dynamic>.from(e)).toList();
    }
    return const [];
  }

  Map<String, dynamic> _map(dynamic data) {
    final payload = data is Map ? (data['data'] ?? data) : data;
    return payload is Map ? Map<String, dynamic>.from(payload) : <String, dynamic>{};
  }

  Future<List<Map<String, dynamic>>> listTerminals({int? branchId, String? status}) async {
    final res = await _dio.get('/pos-terminals', queryParameters: {
      if (branchId != null) 'branch_id': branchId,
      if (status != null && status.isNotEmpty) 'status': status,
    });
    return _list(res.data);
  }

  Future<List<Map<String, dynamic>>> listBranches() async {
    final res = await _dio.get('/branches');
    return _list(res.data);
  }

  /// Returns {terminal, enrollment_code, expires_at}.
  Future<Map<String, dynamic>> createTerminal({
    required int branchId,
    required String terminalName,
    required String terminalType,
  }) async {
    final res = await _dio.post('/pos-terminals', data: {
      'branch_id': branchId,
      'terminal_name': terminalName,
      'terminal_type': terminalType,
    });
    return _map(res.data);
  }

  /// Returns {enrollment_code, expires_at}.
  Future<Map<String, dynamic>> regenerateCode(String terminalId) async {
    final res = await _dio.post('/pos-terminals/$terminalId/enrollment-code');
    return _map(res.data);
  }

  Future<Map<String, dynamic>> updateTerminal(
    String terminalId, {
    String? terminalName,
    String? terminalType,
    String? status,
  }) async {
    final res = await _dio.patch('/pos-terminals/$terminalId', data: {
      if (terminalName != null) 'terminal_name': terminalName,
      if (terminalType != null) 'terminal_type': terminalType,
      if (status != null) 'status': status,
    });
    return _map(res.data);
  }

  Future<Map<String, dynamic>> revokeTerminal(String terminalId) async {
    final res = await _dio.post('/pos-terminals/$terminalId/revoke');
    return _map(res.data);
  }

  /// Returns {terminal, enrollment_code, expires_at}.
  Future<Map<String, dynamic>> transferTerminal(String terminalId, int toBranchId) async {
    final res = await _dio.post('/pos-terminals/$terminalId/transfer', data: {'branch_id': toBranchId});
    return _map(res.data);
  }
}

final posTerminalAdminRepositoryProvider = Provider<PosTerminalAdminRepository>((ref) {
  return PosTerminalAdminRepository(ref.read(dioProvider));
});

final posTerminalsListProvider =
    FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) {
  return ref.read(posTerminalAdminRepositoryProvider).listTerminals();
});

final posTerminalBranchesProvider =
    FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) {
  return ref.read(posTerminalAdminRepositoryProvider).listBranches();
});
