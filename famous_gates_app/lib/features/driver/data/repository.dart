import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/network/dio_client.dart';

final driverRepositoryProvider = Provider<DriverRepository>((ref) {
  return DriverRepository(ref.read(dioProvider));
});

class DriverRepository {
  final Dio _dio;
  DriverRepository(this._dio);

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  List<Map<String, dynamic>> _list(dynamic data) {
    final list = data is List
        ? data
        : (data is Map ? (data['data'] ?? data['items'] ?? data['rows'] ?? []) : []);
    return (list as List)
        .whereType<Map>()
        .map((e) => Map<String, dynamic>.from(e))
        .toList();
  }

  Map<String, dynamic> _map(dynamic data) {
    if (data is Map<String, dynamic>) return data;
    if (data is Map) return Map<String, dynamic>.from(data);
    return <String, dynamic>{};
  }

  // ---------------------------------------------------------------------------
  // Fleet / Vehicles
  // ---------------------------------------------------------------------------

  Future<List<Map<String, dynamic>>> getVehicles() async {
    final res = await _dio.get('/fleet/vehicles');
    return _list(res.data);
  }

  // ---------------------------------------------------------------------------
  // Dispatch Note queries
  // ---------------------------------------------------------------------------

  /// Dispatches currently IN_TRANSIT (driver is delivering).
  Future<List<Map<String, dynamic>>> getActiveDispatches() async {
    final res = await _dio.get('/storekeeping/dispatch-notes',
        queryParameters: {'status': 'IN_TRANSIT'});
    return _list(res.data);
  }

  /// Dispatches that are READY (packed, awaiting driver pickup).
  Future<List<Map<String, dynamic>>> getReadyDispatches() async {
    final res = await _dio.get('/storekeeping/dispatch-notes',
        queryParameters: {'status': 'READY'});
    return _list(res.data);
  }

  /// Completed / CONFIRMED deliveries for trip history.
  Future<List<Map<String, dynamic>>> getDispatchHistory() async {
    final res = await _dio.get('/storekeeping/dispatch-notes',
        queryParameters: {'status': 'CONFIRMED'});
    return _list(res.data);
  }

  /// Full detail of a single dispatch note (items, branches, driver, vehicle).
  Future<Map<String, dynamic>> getDispatchDetail(String id) async {
    final res = await _dio.get('/storekeeping/dispatch-notes/$id');
    return _map(res.data is Map && res.data['data'] != null
        ? res.data['data']
        : res.data);
  }

  // ---------------------------------------------------------------------------
  // Driver OTP verification
  // ---------------------------------------------------------------------------

  /// Driver verifies D-XXXX OTP to confirm goods pickup.
  /// Status changes: pending → in_transit.
  Future<Map<String, dynamic>> verifyDriverOtp(
      String dispatchId, String otp) async {
    final res = await _dio.post(
      '/store/dispatches/$dispatchId/verify-driver-otp',
      data: {'driver_otp': otp.trim().toUpperCase()},
    );
    return _map(res.data);
  }
}
