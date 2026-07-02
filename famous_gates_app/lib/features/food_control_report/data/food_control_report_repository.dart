import 'dart:io';

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:path_provider/path_provider.dart';

import '../../../core/network/dio_client.dart';
import '../../../core/storage/secure_storage_provider.dart';
import '../../auth/data/auth_repository.dart';

final foodControlReportRepositoryProvider =
    Provider<FoodControlReportRepository>((ref) {
  return FoodControlReportRepository(ref.read(dioProvider), ref);
});

class FoodControlReportRepository {
  FoodControlReportRepository(this._dio, this._ref);

  final Dio _dio;
  final Ref _ref;

  Future<int> _resolveBranchId(int? branchId) async {
    if (branchId != null) return branchId;
    final storage = _ref.read(secureStorageProvider);
    final own = await storage.read(key: AuthRepository.branchIdKey) ?? '';
    final parsed = int.tryParse(own);
    if (parsed == null) throw Exception('No branch selected for this account.');
    return parsed;
  }

  Future<Map<String, dynamic>> fetchReport({
    int? branchId,
    required String date,
  }) async {
    final id = await _resolveBranchId(branchId);
    final res = await _dio.get(
      '/branches/$id/food-control-report',
      queryParameters: {'date': date},
      options: Options(receiveTimeout: const Duration(seconds: 120)),
    );
    final data = res.data is Map ? res.data['data'] : null;
    return data is Map ? Map<String, dynamic>.from(data) : <String, dynamic>{};
  }

  /// Downloads the xlsx/pdf export to a local file and returns its path.
  Future<String> downloadExport({
    int? branchId,
    required String date,
    required String format, // xlsx | pdf
  }) async {
    final id = await _resolveBranchId(branchId);
    final res = await _dio.get<List<int>>(
      '/branches/$id/food-control-report/export',
      queryParameters: {'date': date, 'format': format},
      options: Options(
        responseType: ResponseType.bytes,
        receiveTimeout: const Duration(seconds: 120),
      ),
    );
    final dir = await getDownloadsDirectory() ?? await getTemporaryDirectory();
    final file = File('${dir.path}/food_control_${id}_$date.$format');
    await file.writeAsBytes(res.data ?? []);
    return file.path;
  }
}
