import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../network/dio_client.dart';
import 'api_service.dart';

final roomServiceProvider = Provider<RoomService>((ref) {
  return RoomService(ref.watch(dioProvider));
});

class RoomService extends BaseApiService {
  RoomService(super.dio);

  // GET /api/rooms
  Future<Map<String, dynamic>> getRooms({
    String? status,
    String? type,
    int? floor,
    int? branchId,
    bool? isAvailable,
  }) async {
    final query = {
      if (status != null) 'status': status,
      if (type != null) 'type': type,
      if (floor != null) 'floor': floor,
      if (branchId != null) 'branchId': branchId,
      if (isAvailable != null) 'isAvailable': isAvailable,
    };
    final response =
        await get<Map<String, dynamic>>('/rooms', queryParameters: query);
    return response;
  }

  // GET /api/rooms/:id
  Future<Map<String, dynamic>> getRoom(String id) async {
    final response = await get<Map<String, dynamic>>('/rooms/$id');
    return response;
  }

  // POST /api/rooms
  Future<Map<String, dynamic>> createRoom(Map<String, dynamic> roomData) async {
    final response = await post<Map<String, dynamic>>('/rooms', data: roomData);
    return response;
  }

  // PUT /api/rooms/:id
  Future<Map<String, dynamic>> updateRoom(
      String id, Map<String, dynamic> roomData) async {
    final response =
        await put<Map<String, dynamic>>('/rooms/$id', data: roomData);
    return response;
  }

  // PATCH /api/rooms/:id/status
  Future<Map<String, dynamic>> updateRoomStatus(
      String id, String status) async {
    final response = await patch<Map<String, dynamic>>(
      '/rooms/$id/status',
      data: {'status': status},
    );
    return response;
  }

  // DELETE /api/rooms/:id
  Future<Map<String, dynamic>> deleteRoom(String id) async {
    final response = await delete<Map<String, dynamic>>('/rooms/$id');
    return response;
  }

  // GET /api/rooms/types
  Future<List<dynamic>> getRoomTypes() async {
    final response = await get<List<dynamic>>('/rooms/types');
    return response;
  }

  // POST /api/rooms/types
  Future<Map<String, dynamic>> createRoomType(
      Map<String, dynamic> typeData) async {
    final response =
        await post<Map<String, dynamic>>('/rooms/types', data: typeData);
    return response;
  }

  // GET /api/rooms/rate-plans
  Future<Map<String, dynamic>> getRatePlans({int? branchId}) async {
    final query = {if (branchId != null) 'branchId': branchId};
    final response =
        await get<Map<String, dynamic>>('/rate-plans', queryParameters: query);
    return response;
  }

  // POST /api/rooms/rate-plans
  Future<Map<String, dynamic>> createRatePlan(
      Map<String, dynamic> ratePlan) async {
    final response =
        await post<Map<String, dynamic>>('/rate-plans', data: ratePlan);
    return response;
  }

  // PUT /api/rooms/rate-plans/:id
  Future<Map<String, dynamic>> updateRatePlan(
      String id, Map<String, dynamic> ratePlan) async {
    final response =
        await put<Map<String, dynamic>>('/rate-plans/$id', data: ratePlan);
    return response;
  }

  // DELETE /api/rooms/rate-plans/:id
  Future<Map<String, dynamic>> deleteRatePlan(String id) async {
    final response = await delete<Map<String, dynamic>>('/rate-plans/$id');
    return response;
  }

  // GET /api/rooms/grid
  Future<Map<String, dynamic>> getRoomGrid(
      {int? branchId, String? date}) async {
    final query = {
      if (branchId != null) 'branchId': branchId,
      if (date != null) 'date': date,
    };
    final response =
        await get<Map<String, dynamic>>('/rooms/grid', queryParameters: query);
    return response;
  }

  // GET /api/rooms/occupancy
  Future<Map<String, dynamic>> getOccupancyStats(
      {int? branchId, String? period}) async {
    final query = {
      if (branchId != null) 'branchId': branchId,
      if (period != null) 'period': period,
    };
    final response = await get<Map<String, dynamic>>('/rooms/occupancy',
        queryParameters: query);
    return response;
  }

  // POST /api/rooms/:id/maintenance
  Future<Map<String, dynamic>> setMaintenance(
      String id, Map<String, dynamic> maintenance) async {
    final response = await post<Map<String, dynamic>>('/rooms/$id/maintenance',
        data: maintenance);
    return response;
  }

  // GET /api/rooms/:id/history
  Future<Map<String, dynamic>> getRoomHistory(String id) async {
    final response = await get<Map<String, dynamic>>('/rooms/$id/history');
    return response;
  }
}
