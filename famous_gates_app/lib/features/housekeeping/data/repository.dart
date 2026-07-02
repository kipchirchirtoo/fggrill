import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/network/dio_client.dart';
import '../../../core/storage/secure_storage_provider.dart';
import '../../auth/data/auth_repository.dart';
import '../domain/models.dart';

final housekeepingRepositoryProvider = Provider<HousekeepingRepository>((ref) {
  return HousekeepingRepository(ref.read(dioProvider), ref);
});

class HousekeepingRepository {
  HousekeepingRepository(this._dio, this._ref);

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

  Future<List<HkRoom>> getRooms() async {
    final branchId = await _branchId;
    final response = await _dio.get('/housekeeping/rooms', queryParameters: {
      if (branchId.isNotEmpty) 'branchId': branchId,
    });
    return _parseList(response.data, HkRoom.fromJson);
  }

  Future<void> updateRoomStatus(String roomId, String status) async {
    await _dio
        .put('/housekeeping/rooms/$roomId/status', data: {'status': status});
  }

  Future<List<HkTask>> getTasks({String? status}) async {
    final branchId = await _branchId;
    final response = await _dio.get('/housekeeping/tasks', queryParameters: {
      if (branchId.isNotEmpty) 'branchId': branchId,
      if (status != null) 'status': status,
    });
    return _parseList(response.data, HkTask.fromJson);
  }

  Future<void> createTask(Map<String, dynamic> data) async {
    await _dio.post('/housekeeping/tasks', data: data);
  }

  Future<void> updateTaskStatus(String taskId, String status) async {
    await _dio
        .put('/housekeeping/tasks/$taskId/status', data: {'status': status});
  }

  Future<void> assignTask(String taskId, String staffId) async {
    await _dio
        .put('/housekeeping/tasks/$taskId/assign', data: {'staff_id': staffId});
  }

  Future<List<Map<String, dynamic>>> getInspections({String? status}) async {
    final branchId = await _branchId;
    final response =
        await _dio.get('/housekeeping/inspections', queryParameters: {
      if (branchId.isNotEmpty) 'branchId': branchId,
      if (status != null) 'status': status,
    });
    return _parseList(response.data, (j) => j);
  }

  Future<void> createInspection(Map<String, dynamic> data) async {
    await _dio.post('/housekeeping/inspections', data: data);
  }

  Future<void> updateInspection(String id, Map<String, dynamic> data) async {
    await _dio.put('/housekeeping/inspections/$id', data: data);
  }

  Future<List<Map<String, dynamic>>> getLostFound({String? status}) async {
    final branchId = await _branchId;
    final response =
        await _dio.get('/housekeeping/lost-found', queryParameters: {
      if (branchId.isNotEmpty) 'branchId': branchId,
      if (status != null) 'status': status,
    });
    return _parseList(response.data, (j) => j);
  }

  Future<void> reportLostFoundItem(Map<String, dynamic> data) async {
    await _dio.post('/housekeeping/lost-found', data: data);
  }

  Future<void> updateLostFoundStatus(String id, String status) async {
    await _dio
        .put('/housekeeping/lost-found/$id/status', data: {'status': status});
  }

  Future<List<Map<String, dynamic>>> getSuppliesInventory() async {
    final branchId = await _branchId;
    final response = await _dio.get('/housekeeping/supplies', queryParameters: {
      if (branchId.isNotEmpty) 'branchId': branchId,
    });
    return _parseList(response.data, (j) => j);
  }

  Future<void> requestSupplies(Map<String, dynamic> data) async {
    await _dio.post('/housekeeping/supplies/request', data: data);
  }

  Future<List<Map<String, dynamic>>> getSchedule({String? date}) async {
    final targetDate = date ?? DateTime.now().toIso8601String().split('T').first;
    final response =
        await _dio.get('/housekeeping/scheduling/schedules', queryParameters: {
      'startDate': targetDate,
      'endDate': targetDate,
    });
    return _parseList(response.data, (j) => j);
  }

  Future<void> createScheduleEntry(Map<String, dynamic> data) async {
    await _dio.post('/housekeeping/scheduling/schedules', data: data);
  }

  Future<List<Map<String, dynamic>>> getStaff() async {
    final response = await _dio.get('/housekeeping/staff');
    return _parseList(response.data, (j) => j);
  }

  Future<List<Map<String, dynamic>>> getShiftDefinitions() async {
    final branchId = await _branchId;
    final response =
        await _dio.get('/housekeeping/scheduling/shifts', queryParameters: {
      if (branchId.isNotEmpty) 'branchId': branchId,
    });
    return _parseList(response.data, (j) => j);
  }
}
