import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/network/dio_client.dart';

final driverRepositoryProvider = Provider<DriverRepository>((ref) {
  return DriverRepository(ref.read(dioProvider));
});

class DriverRepository {
  final Dio _dio;
  DriverRepository(this._dio);

  Future<List<Map<String, dynamic>>> getVehicles() async {
    final res = await _dio.get('/fleet/vehicles');
    final data = res.data;
    final list =
        data is List ? data : (data is Map ? (data['data'] ?? []) : []);
    return (list as List)
        .whereType<Map>()
        .map((e) => Map<String, dynamic>.from(e))
        .toList();
  }
}
