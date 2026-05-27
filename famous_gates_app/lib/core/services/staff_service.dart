import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../network/dio_client.dart';
import 'api_service.dart';

final staffServiceProvider = Provider<StaffService>((ref) {
  return StaffService(ref.watch(dioProvider));
});

class StaffService extends BaseApiService {
  StaffService(super.dio);

  // GET /api/staff
  Future<Map<String, dynamic>> getStaff({
    String? search,
    String? department,
    String? status,
    int? branchId,
    int page = 1,
    int limit = 50,
  }) async {
    final query = {
      if (search != null) 'search': search,
      if (department != null) 'department': department,
      if (status != null) 'status': status,
      if (branchId != null) 'branch_id': branchId,
      'page': page,
      'limit': limit,
    };
    final response =
        await get<Map<String, dynamic>>('/staff', queryParameters: query);
    return response;
  }

  // GET /api/staff/:id
  Future<Map<String, dynamic>> getStaffMember(String id) async {
    final response = await get<Map<String, dynamic>>('/staff/$id');
    return response;
  }

  // POST /api/staff
  Future<Map<String, dynamic>> createStaffMember(
      Map<String, dynamic> staffData) async {
    final response =
        await post<Map<String, dynamic>>('/staff', data: staffData);
    return response;
  }

  // PUT /api/staff/:id
  Future<Map<String, dynamic>> updateStaffMember(
      String id, Map<String, dynamic> staffData) async {
    final response =
        await put<Map<String, dynamic>>('/staff/$id', data: staffData);
    return response;
  }

  // POST /api/staff/:id/photo
  Future<Map<String, dynamic>> uploadStaffPhoto(
      String id, String filePath) async {
    final formData = FormData.fromMap({
      'photo': await MultipartFile.fromFile(filePath),
    });
    final response = await dio.post<Map<String, dynamic>>('/staff/$id/photo',
        data: formData);
    return response.data ?? <String, dynamic>{};
  }

  // DELETE /api/staff/:id
  Future<Map<String, dynamic>> deleteStaffMember(String id) async {
    final response = await delete<Map<String, dynamic>>('/staff/$id');
    return response;
  }

  // GET /api/staff/:id/performance
  Future<Map<String, dynamic>> getStaffPerformance(String id) async {
    final response = await get<Map<String, dynamic>>('/staff/$id/performance');
    return response;
  }

  // POST /api/staff/:id/performance
  Future<Map<String, dynamic>> addPerformanceReview(
      String id, Map<String, dynamic> review) async {
    final response = await post<Map<String, dynamic>>('/staff/$id/performance',
        data: review);
    return response;
  }

  // GET /api/staff/:id/attendance
  Future<Map<String, dynamic>> getStaffAttendance(String id,
      {String? startDate, String? endDate}) async {
    final query = {
      if (startDate != null) 'startDate': startDate,
      if (endDate != null) 'endDate': endDate,
    };
    final response = await get<Map<String, dynamic>>('/staff/$id/attendance',
        queryParameters: query);
    return response;
  }

  // POST /api/staff/:id/attendance
  Future<Map<String, dynamic>> recordAttendance(
      String id, Map<String, dynamic> attendance) async {
    final response = await post<Map<String, dynamic>>('/staff/$id/attendance',
        data: attendance);
    return response;
  }

  // GET /api/staff/departments
  Future<List<dynamic>> getDepartments() async {
    final response = await get<List<dynamic>>('/staff/departments');
    return response;
  }

  // GET /api/staff/positions
  Future<List<dynamic>> getPositions() async {
    final response = await get<List<dynamic>>('/staff/positions');
    return response;
  }

  // GET /api/staff/shifts
  Future<Map<String, dynamic>> getShifts({String? date, int? branchId}) async {
    final query = {
      if (date != null) 'date': date,
      if (branchId != null) 'branchId': branchId,
    };
    final response = await get<Map<String, dynamic>>('/staff/shifts',
        queryParameters: query);
    return response;
  }

  // POST /api/staff/shifts
  Future<Map<String, dynamic>> createShift(
      Map<String, dynamic> shiftData) async {
    final response =
        await post<Map<String, dynamic>>('/staff/shifts', data: shiftData);
    return response;
  }

  // PUT /api/staff/shifts/:id
  Future<Map<String, dynamic>> updateShift(
      String id, Map<String, dynamic> shiftData) async {
    final response =
        await put<Map<String, dynamic>>('/staff/shifts/$id', data: shiftData);
    return response;
  }

  // DELETE /api/staff/shifts/:id
  Future<Map<String, dynamic>> deleteShift(String id) async {
    final response = await delete<Map<String, dynamic>>('/staff/shifts/$id');
    return response;
  }

  // GET /api/staff/audit
  Future<Map<String, dynamic>> getStaffAudit(
      {String? startDate, String? endDate, int? branchId}) async {
    final query = {
      if (startDate != null) 'startDate': startDate,
      if (endDate != null) 'endDate': endDate,
      if (branchId != null) 'branchId': branchId,
    };
    final response =
        await get<Map<String, dynamic>>('/staff/audit', queryParameters: query);
    return response;
  }
}
