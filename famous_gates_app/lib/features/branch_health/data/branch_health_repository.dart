import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/dio_client.dart';
import '../../../core/storage/secure_storage_provider.dart';
import '../../auth/data/auth_repository.dart';
import '../domain/branch_health_models.dart';

final branchHealthRepositoryProvider = Provider<BranchHealthRepository>((ref) {
  return BranchHealthRepository(ref.read(dioProvider), ref);
});

class BranchHealthRepository {
  BranchHealthRepository(this._dio, this._ref);

  final Dio _dio;
  final Ref _ref;

  Future<String> _getOwnBranchId() async {
    final storage = _ref.read(secureStorageProvider);
    return await storage.read(key: AuthRepository.branchIdKey) ?? '';
  }

  /// Resolves the branch to check: an explicit [branchId] (central roles
  /// inspecting any branch) or the signed-in user's own branch.
  Future<String> _resolveBranchId(int? branchId) async {
    if (branchId != null) return '$branchId';
    final own = await _getOwnBranchId();
    if (own.isEmpty) {
      throw BranchHealthException('No branch selected for this account.');
    }
    return own;
  }

  /// Cached result (backend reruns automatically if older than 24h).
  Future<BranchHealthResult> fetchHealthCheck({int? branchId}) async {
    final id = await _resolveBranchId(branchId);
    try {
      final res = await _dio.get(
        '/branches/$id/health-check',
        // The AI interpretation can take a while on a cache miss.
        options: Options(receiveTimeout: const Duration(seconds: 90)),
      );
      return _parseResult(res.data);
    } on DioException catch (e) {
      throw _friendlyError(e);
    }
  }

  /// Forces a fresh check (rate limited server-side to 1 per 5 minutes).
  Future<BranchHealthResult> refreshHealthCheck({int? branchId}) async {
    final id = await _resolveBranchId(branchId);
    try {
      final res = await _dio.post(
        '/branches/$id/health-check/refresh',
        options: Options(receiveTimeout: const Duration(seconds: 90)),
      );
      return _parseResult(res.data);
    } on DioException catch (e) {
      throw _friendlyError(e);
    }
  }

  /// All-branch deterministic overview (central oversight roles only).
  Future<List<FleetBranchHealth>> fetchFleetHealth() async {
    try {
      final res = await _dio.get(
        '/branches/fleet/health-check',
        options: Options(receiveTimeout: const Duration(seconds: 90)),
      );
      final map = res.data is Map
          ? Map<String, dynamic>.from(res.data as Map)
          : <String, dynamic>{};
      final payload = map['data'];
      final rawBranches = payload is Map ? payload['branches'] : null;
      if (rawBranches is! List) {
        throw BranchHealthException('Unexpected response from the server.');
      }
      final branches = rawBranches
          .whereType<Map>()
          .map((b) => FleetBranchHealth.fromJson(Map<String, dynamic>.from(b)))
          .toList()
        ..sort((a, b) => a.healthScore.compareTo(b.healthScore));
      return branches;
    } on DioException catch (e) {
      throw _friendlyError(e);
    }
  }

  BranchHealthResult _parseResult(dynamic data) {
    final map = data is Map ? Map<String, dynamic>.from(data) : <String, dynamic>{};
    final payload = map['data'];
    if (payload is Map) {
      return BranchHealthResult.fromJson(Map<String, dynamic>.from(payload));
    }
    throw BranchHealthException('Unexpected response from the server.');
  }

  BranchHealthException _friendlyError(DioException e) {
    if (e.response?.statusCode == 429) {
      return BranchHealthException(
          'A fresh check was run recently. Please wait a few minutes before refreshing again.');
    }
    if (e.response?.statusCode == 403) {
      final message = e.response?.data is Map
          ? (e.response!.data as Map)['message']?.toString()
          : null;
      return BranchHealthException(message ?? 'Access denied.');
    }
    final message = e.response?.data is Map
        ? (e.response!.data as Map)['message']?.toString()
        : null;
    return BranchHealthException(
        message ?? 'Could not run the health check. Please try again.');
  }
}

class BranchHealthException implements Exception {
  BranchHealthException(this.message);
  final String message;

  @override
  String toString() => message;
}
