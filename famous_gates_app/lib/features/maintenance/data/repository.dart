import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/network/dio_client.dart';
import '../../../core/storage/secure_storage_provider.dart';
import '../../auth/data/auth_repository.dart';
import '../domain/models.dart';

final maintenanceRepositoryProvider = Provider<MaintenanceRepository>((ref) {
  return MaintenanceRepository(ref.read(dioProvider), ref);
});

class MaintenanceRepository {
  MaintenanceRepository(this._dio, this._ref);

  final Dio _dio;
  final Ref _ref;

  Future<String> get _branchId async {
    final storage = _ref.read(secureStorageProvider);
    return await storage.read(key: AuthRepository.branchIdKey) ?? '';
  }

  List<T> _parseList<T>(
      dynamic data, T Function(Map<String, dynamic>) fromJson) {
    final list =
        data is List ? data : (data is Map ? (data['data'] ?? []) : []);
    return (list as List)
        .whereType<Map>()
        .map((json) => fromJson(Map<String, dynamic>.from(json)))
        .toList();
  }

  Future<List<WorkOrder>> getWorkOrders({String? status}) async {
    final branchId = await _branchId;
    final response = await _dio.get('/housekeeping/tasks', queryParameters: {
      if (branchId.isNotEmpty) 'branch_id': branchId,
      'category': 'maintenance',
      if (status != null) 'status': status,
    });
    return _parseList(response.data, WorkOrder.fromJson);
  }

  Future<void> createWorkOrder(Map<String, dynamic> data) async {
    await _dio.post('/housekeeping/tasks', data: {
      ...data,
      'category': 'maintenance',
    });
  }

  Future<void> updateStatus(String id, String status) async {
    await _dio.put('/housekeeping/tasks/$id/status', data: {'status': status});
  }

  // Assets
  Future<List<Map<String, dynamic>>> getAssets({String? status}) async {
    final branchId = await _branchId;
    final response =
        await _dio.get('/maintenance-enhanced/assets', queryParameters: {
      if (branchId.isNotEmpty) 'branch_id': branchId,
      if (status != null) 'status': status,
    });
    return _parseList(response.data, (j) => j);
  }

  Future<void> createAsset(Map<String, dynamic> data) async {
    await _dio.post('/maintenance-enhanced/assets', data: data);
  }

  Future<void> updateAsset(String id, Map<String, dynamic> data) async {
    await _dio.put('/maintenance-enhanced/assets/$id', data: data);
  }

  // Schedule
  Future<List<Map<String, dynamic>>> getMaintenanceSchedule(
      {String? date}) async {
    final branchId = await _branchId;
    final response =
        await _dio.get('/maintenance-enhanced/schedule', queryParameters: {
      if (branchId.isNotEmpty) 'branch_id': branchId,
      if (date != null) 'date': date,
    });
    return _parseList(response.data, (j) => j);
  }

  Future<void> createScheduleEntry(Map<String, dynamic> data) async {
    await _dio.post('/maintenance-enhanced/schedule', data: data);
  }
}
