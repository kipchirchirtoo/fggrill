import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../network/dio_client.dart';
import 'api_service.dart';

final maintenanceServiceProvider = Provider<MaintenanceService>((ref) {
  return MaintenanceService(ref.watch(dioProvider));
});

class MaintenanceService extends BaseApiService {
  MaintenanceService(super.dio);

  // GET /api/maintenance/requests
  Future<Map<String, dynamic>> getRequests({
    String? status,
    String? priority,
    String? category,
    int? roomId,
    int? assigneeId,
    int? branchId,
  }) async {
    final query = {
      if (status != null) 'status': status,
      if (priority != null) 'priority': priority,
      if (category != null) 'category': category,
      if (roomId != null) 'roomId': roomId,
      if (assigneeId != null) 'assigneeId': assigneeId,
      if (branchId != null) 'branchId': branchId,
    };
    final response = await get<Map<String, dynamic>>('/maintenance/requests',
        queryParameters: query);
    return response;
  }

  // GET /api/maintenance/requests/:id
  Future<Map<String, dynamic>> getRequest(String id) async {
    final response =
        await get<Map<String, dynamic>>('/maintenance/requests/$id');
    return response;
  }

  // POST /api/maintenance/requests
  Future<Map<String, dynamic>> createRequest(
      Map<String, dynamic> request) async {
    final response = await post<Map<String, dynamic>>('/maintenance/requests',
        data: request);
    return response;
  }

  // PUT /api/maintenance/requests/:id
  Future<Map<String, dynamic>> updateRequest(
      String id, Map<String, dynamic> request) async {
    final response = await put<Map<String, dynamic>>(
        '/maintenance/requests/$id',
        data: request);
    return response;
  }

  // PATCH /api/maintenance/requests/:id/status
  Future<Map<String, dynamic>> updateRequestStatus(
      String id, String status) async {
    final response = await patch<Map<String, dynamic>>(
      '/maintenance/requests/$id/status',
      data: {'status': status},
    );
    return response;
  }

  // POST /api/maintenance/requests/:id/assign
  Future<Map<String, dynamic>> assignRequest(String id, int assigneeId) async {
    final response = await post<Map<String, dynamic>>(
      '/maintenance/requests/$id/assign',
      data: {'assigneeId': assigneeId},
    );
    return response;
  }

  // POST /api/maintenance/requests/:id/complete
  Future<Map<String, dynamic>> completeRequest(
      String id, Map<String, dynamic> completion) async {
    final response = await post<Map<String, dynamic>>(
        '/maintenance/requests/$id/complete',
        data: completion);
    return response;
  }

  // GET /api/maintenance/schedule
  Future<Map<String, dynamic>> getSchedule(
      {String? date, int? branchId}) async {
    final query = {
      if (date != null) 'date': date,
      if (branchId != null) 'branchId': branchId,
    };
    final response = await get<Map<String, dynamic>>('/maintenance/schedule',
        queryParameters: query);
    return response;
  }

  // GET /api/maintenance/assets
  Future<Map<String, dynamic>> getAssets(
      {int? branchId, String? category}) async {
    final query = {
      if (branchId != null) 'branchId': branchId,
      if (category != null) 'category': category,
    };
    final response = await get<Map<String, dynamic>>('/maintenance/assets',
        queryParameters: query);
    return response;
  }

  // POST /api/maintenance/assets
  Future<Map<String, dynamic>> createAsset(Map<String, dynamic> asset) async {
    final response =
        await post<Map<String, dynamic>>('/maintenance/assets', data: asset);
    return response;
  }

  // GET /api/maintenance/assets/:id/history
  Future<Map<String, dynamic>> getAssetHistory(String id) async {
    final response =
        await get<Map<String, dynamic>>('/maintenance/assets/$id/history');
    return response;
  }

  // POST /api/maintenance/assets/:id/maintenance
  Future<Map<String, dynamic>> scheduleAssetMaintenance(
      String id, Map<String, dynamic> schedule) async {
    final response = await post<Map<String, dynamic>>(
        '/maintenance/assets/$id/maintenance',
        data: schedule);
    return response;
  }

  // GET /api/maintenance/inventory
  Future<Map<String, dynamic>> getInventory({int? branchId}) async {
    final query = {if (branchId != null) 'branchId': branchId};
    final response = await get<Map<String, dynamic>>('/maintenance/inventory',
        queryParameters: query);
    return response;
  }

  // POST /api/maintenance/inventory/request
  Future<Map<String, dynamic>> requestInventory(
      Map<String, dynamic> request) async {
    final response = await post<Map<String, dynamic>>(
        '/maintenance/inventory/request',
        data: request);
    return response;
  }

  // GET /api/maintenance/staff
  Future<Map<String, dynamic>> getMaintenanceStaff({int? branchId}) async {
    final query = {if (branchId != null) 'branchId': branchId};
    final response = await get<Map<String, dynamic>>('/maintenance/staff',
        queryParameters: query);
    return response;
  }

  // GET /api/maintenance/reports
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
    final response = await get<Map<String, dynamic>>('/maintenance/reports',
        queryParameters: query);
    return response;
  }

  // GET /api/maintenance-enhanced/inspections
  Future<Map<String, dynamic>> getInspections(
      {int? branchId, String? status}) async {
    final query = {
      if (branchId != null) 'branchId': branchId,
      if (status != null) 'status': status,
    };
    final response = await get<Map<String, dynamic>>(
        '/maintenance-enhanced/inspections',
        queryParameters: query);
    return response;
  }

  // POST /api/maintenance-enhanced/inspections
  Future<Map<String, dynamic>> createInspection(
      Map<String, dynamic> inspection) async {
    final response = await post<Map<String, dynamic>>(
        '/maintenance-enhanced/inspections',
        data: inspection);
    return response;
  }

  // GET /api/facilities/areas
  Future<Map<String, dynamic>> getFacilityAreas({int? branchId}) async {
    final query = {if (branchId != null) 'branchId': branchId};
    final response = await get<Map<String, dynamic>>('/facilities/areas',
        queryParameters: query);
    return response;
  }

  // GET /api/facilities/utilities
  Future<Map<String, dynamic>> getUtilities(
      {int? branchId, String? type}) async {
    final query = {
      if (branchId != null) 'branchId': branchId,
      if (type != null) 'type': type,
    };
    final response = await get<Map<String, dynamic>>('/facilities/utilities',
        queryParameters: query);
    return response;
  }

  // POST /api/facilities/utilities/reading
  Future<Map<String, dynamic>> recordUtilityReading(
      Map<String, dynamic> reading) async {
    final response = await post<Map<String, dynamic>>(
        '/facilities/utilities/reading',
        data: reading);
    return response;
  }
}
