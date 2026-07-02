import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/dio_client.dart';
import '../../../core/storage/secure_storage_provider.dart';
import '../../auth/data/auth_repository.dart';

final linaDailyControlsRepositoryProvider =
    Provider<LinaDailyControlsRepository>((ref) {
  return LinaDailyControlsRepository(ref.read(dioProvider), ref);
});

/// Data source for the Daily Controls (Lina) page. The deterministic tabs use
/// the SAME backend endpoints as the storekeeper Daily Controls page
/// (/kitchen/daily-control*); the briefing comes from Lina
/// (/lina/daily-food-control), which interprets that same payload with AI.
class LinaDailyControlsRepository {
  LinaDailyControlsRepository(this._dio, this._ref);

  final Dio _dio;
  final Ref _ref;

  Future<int> _resolveBranchId(int? branchId) async {
    if (branchId != null) return branchId;
    final storage = _ref.read(secureStorageProvider);
    final own = await storage.read(key: AuthRepository.branchIdKey) ?? '';
    final parsed = int.tryParse(own);
    if (parsed == null) {
      throw Exception('No branch selected for this account.');
    }
    return parsed;
  }

  Future<Map<String, dynamic>> dailyControlData({
    int? branchId,
    required String date,
    String? shift,
  }) async {
    final id = await _resolveBranchId(branchId);
    final res = await _dio.get('/kitchen/daily-control', queryParameters: {
      'branch_id': id,
      'date': date,
      if (shift != null) 'shift': shift,
    });
    final data = res.data is Map ? res.data['data'] : null;
    return data is Map ? Map<String, dynamic>.from(data) : <String, dynamic>{};
  }

  Future<List<Map<String, dynamic>>> stockLedger({
    int? branchId,
    required String date,
    String? shift,
  }) async {
    final id = await _resolveBranchId(branchId);
    final res =
        await _dio.get('/kitchen/daily-control/stock-ledger', queryParameters: {
      'branch_id': id,
      'date': date,
      if (shift != null) 'shift': shift,
    });
    final data = res.data is Map ? res.data['data'] : null;
    if (data is List) {
      return data
          .whereType<Map>()
          .map((e) => Map<String, dynamic>.from(e))
          .toList();
    }
    return [];
  }

  /// Lina's AI briefing over the day's controls. Slower than the tabs
  /// (one Claude call, ~20-40s on a cache miss) — load it independently.
  Future<Map<String, dynamic>> briefing({
    int? branchId,
    required String date,
    String? shift,
    bool forceRefresh = false,
  }) async {
    final id = await _resolveBranchId(branchId);
    final res = await _dio.get(
      '/lina/daily-food-control',
      queryParameters: {
        'branch_id': id,
        'date': date,
        if (shift != null) 'shift': shift,
        if (forceRefresh) 'force_refresh': 'true',
      },
      options: Options(receiveTimeout: const Duration(seconds: 120)),
    );
    final data = res.data is Map ? res.data['data'] : null;
    return data is Map ? Map<String, dynamic>.from(data) : <String, dynamic>{};
  }
}
