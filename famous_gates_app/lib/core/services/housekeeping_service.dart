import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../network/dio_client.dart';
import 'api_service.dart';

final housekeepingServiceProvider = Provider<HousekeepingService>((ref) {
  return HousekeepingService(ref.watch(dioProvider));
});

class HousekeepingService extends BaseApiService {
  HousekeepingService(super.dio);

  // GET /api/housekeeping/tasks
  Future<Map<String, dynamic>> getTasks({
    String? status,
    String? priority,
    String? roomId,
    int? assigneeId,
    int? branchId,
  }) async {
    final query = {
      if (status != null) 'status': status,
      if (priority != null) 'priority': priority,
      if (roomId != null) 'roomId': roomId,
      if (assigneeId != null) 'assigneeId': assigneeId,
      if (branchId != null) 'branchId': branchId,
    };
    final response = await get<Map<String, dynamic>>('/housekeeping/tasks',
        queryParameters: query);
    return response;
  }

  // GET /api/housekeeping/tasks/:id
  Future<Map<String, dynamic>> getTask(String id) async {
    final response = await get<Map<String, dynamic>>('/housekeeping/tasks/$id');
    return response;
  }

  // POST /api/housekeeping/tasks
  Future<Map<String, dynamic>> createTask(Map<String, dynamic> task) async {
    final response =
        await post<Map<String, dynamic>>('/housekeeping/tasks', data: task);
    return response;
  }

  // PUT /api/housekeeping/tasks/:id
  Future<Map<String, dynamic>> updateTask(
      String id, Map<String, dynamic> task) async {
    final response =
        await put<Map<String, dynamic>>('/housekeeping/tasks/$id', data: task);
    return response;
  }

  // PATCH /api/housekeeping/tasks/:id/status
  Future<Map<String, dynamic>> updateTaskStatus(
      String id, String status) async {
    final response = await patch<Map<String, dynamic>>(
      '/housekeeping/tasks/$id/status',
      data: {'status': status},
    );
    return response;
  }

  // POST /api/housekeeping/tasks/:id/assign
  Future<Map<String, dynamic>> assignTask(String id, int assigneeId) async {
    final response = await post<Map<String, dynamic>>(
      '/housekeeping/tasks/$id/assign',
      data: {'assigneeId': assigneeId},
    );
    return response;
  }

  // GET /api/housekeeping/schedule
  Future<Map<String, dynamic>> getSchedule(
      {String? date, int? branchId}) async {
    final query = {
      if (date != null) 'date': date,
      if (branchId != null) 'branchId': branchId,
    };
    final response = await get<Map<String, dynamic>>('/housekeeping/schedule',
        queryParameters: query);
    return response;
  }

  // GET /api/housekeeping/rooms
  Future<Map<String, dynamic>> getHousekeepingRooms(
      {int? branchId, String? status}) async {
    final query = {
      if (branchId != null) 'branchId': branchId,
      if (status != null) 'status': status,
    };
    final response = await get<Map<String, dynamic>>('/housekeeping/rooms',
        queryParameters: query);
    return response;
  }

  // POST /api/housekeeping/rooms/:id/inspect
  Future<Map<String, dynamic>> inspectRoom(
      String id, Map<String, dynamic> inspection) async {
    final response = await post<Map<String, dynamic>>(
        '/housekeeping/rooms/$id/inspect',
        data: inspection);
    return response;
  }

  // POST /api/housekeeping/rooms/:id/clean
  Future<Map<String, dynamic>> markRoomClean(String id) async {
    final response =
        await post<Map<String, dynamic>>('/housekeeping/rooms/$id/clean');
    return response;
  }

  // POST /api/housekeeping/rooms/:id/dirty
  Future<Map<String, dynamic>> markRoomDirty(String id) async {
    final response =
        await post<Map<String, dynamic>>('/housekeeping/rooms/$id/dirty');
    return response;
  }

  // GET /api/housekeeping/inventory
  Future<Map<String, dynamic>> getInventory({int? branchId}) async {
    final query = {if (branchId != null) 'branchId': branchId};
    final response = await get<Map<String, dynamic>>('/housekeeping/inventory',
        queryParameters: query);
    return response;
  }

  // POST /api/housekeeping/inventory/request
  Future<Map<String, dynamic>> requestInventory(
      Map<String, dynamic> request) async {
    final response = await post<Map<String, dynamic>>(
        '/housekeeping/inventory/request',
        data: request);
    return response;
  }

  // GET /api/housekeeping/staff
  Future<Map<String, dynamic>> getHousekeepingStaff({int? branchId}) async {
    final query = {if (branchId != null) 'branchId': branchId};
    final response = await get<Map<String, dynamic>>('/housekeeping/staff',
        queryParameters: query);
    return response;
  }

  // GET /api/housekeeping/reports
  Future<Map<String, dynamic>> getReports({
    String? startDate,
    String? endDate,
    String? type,
    int? branchId,
  }) async {
    final query = {
      if (startDate != null) 'startDate': startDate,
      if (endDate != null) 'endDate': endDate,
      if (type != null) 'type': type,
      if (branchId != null) 'branchId': branchId,
    };
    final response = await get<Map<String, dynamic>>('/housekeeping/reports',
        queryParameters: query);
    return response;
  }

  // GET /api/housekeeping/lost-found
  Future<Map<String, dynamic>> getLostFound({
    String? status,
    int? branchId,
    int page = 1,
    int limit = 50,
  }) async {
    final query = {
      if (status != null) 'status': status,
      if (branchId != null) 'branchId': branchId,
      'page': page,
      'limit': limit,
    };
    final response = await get<Map<String, dynamic>>('/housekeeping/lost-found',
        queryParameters: query);
    return response;
  }

  // POST /api/housekeeping/lost-found
  Future<Map<String, dynamic>> reportLostFound(
      Map<String, dynamic> item) async {
    final response = await post<Map<String, dynamic>>(
        '/housekeeping/lost-found',
        data: item);
    return response;
  }

  // PUT /api/housekeeping/lost-found/:id
  Future<Map<String, dynamic>> updateLostFound(
      String id, Map<String, dynamic> item) async {
    final response = await put<Map<String, dynamic>>(
        '/housekeeping/lost-found/$id',
        data: item);
    return response;
  }
}
