import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:path_provider/path_provider.dart';
import 'dart:io';
import '../../../core/network/dio_client.dart';
import '../../../core/storage/secure_storage_provider.dart';
import '../../auth/data/auth_repository.dart';
import '../domain/models.dart';

final hrRepositoryProvider = Provider<HRRepository>((ref) {
  return HRRepository(ref.read(dioProvider), ref);
});

class HRRepository {
  HRRepository(this._dio, this._ref);

  final Dio _dio;
  final Ref _ref;

  Future<String> get _branchId async {
    final storage = _ref.read(secureStorageProvider);
    final value = await storage.read(key: AuthRepository.branchIdKey) ?? '';
    final normalized = value.trim();
    final lower = normalized.toLowerCase();
    return lower == 'null' || lower == 'nan' ? '' : normalized;
  }

  List<T> _parseList<T>(
      dynamic data, T Function(Map<String, dynamic>) fromJson) {
    dynamic list = data is List ? data : (data is Map ? data['data'] : null);
    if (list is Map) {
      list = list['items'] ??
          list['records'] ??
          list['results'] ??
          list['performance'] ??
          list['leaderboard'] ??
          [];
    }
    list ??= [];
    return (list as List)
        .whereType<Map>()
        .map((json) => fromJson(Map<String, dynamic>.from(json)))
        .toList();
  }

  Future<List<StaffMember>> getStaff({String? search, String? role}) async {
    final branchId = await _branchId;
    final query = {
      if (branchId.isNotEmpty) 'branch_id': branchId,
      if (search != null) 'search': search,
      if (role != null) 'role': role,
      'page': 1,
      'limit': 5000,
      'source': 'staff_profiles',
    };
    final response = await _dio.get('/staff', queryParameters: query);
    final staff = _parseList(response.data, StaffMember.fromJson);
    final data = response.data;
    final pages = data is Map
        ? int.tryParse('${data['pages'] ?? data['totalPages'] ?? 1}') ?? 1
        : 1;
    if (pages <= 1) return staff;

    final allStaff = [...staff];
    for (var page = 2; page <= pages; page++) {
      final next =
          await _dio.get('/staff', queryParameters: {...query, 'page': page});
      allStaff.addAll(_parseList(next.data, StaffMember.fromJson));
    }
    final seen = <String>{};
    return allStaff.where((member) => seen.add(member.id)).toList();
  }

  Future<void> createStaff(Map<String, dynamic> data) async {
    await _dio.post('/staff', data: data);
  }

  Future<void> updateStaff(String id, Map<String, dynamic> data) async {
    await _dio.put('/staff/$id', data: data);
  }

  Future<void> deleteStaff(String id) async {
    await _dio.delete('/staff/$id');
  }

  Future<StaffMember> getStaffMember(String id) async {
    final response = await _dio.get('/staff/$id');
    final data = response.data is Map && response.data['data'] != null
        ? response.data['data']
        : response.data;
    return StaffMember.fromJson(Map<String, dynamic>.from(data));
  }

  Future<void> archiveStaff(String id, {String? notes}) async {
    await _dio.post('/staff/$id/archive',
        data: {if (notes != null && notes.isNotEmpty) 'notes': notes});
  }

  Future<void> uploadStaffPhoto(String id, String filePath) async {
    final formData = FormData.fromMap({
      'photo': await MultipartFile.fromFile(filePath),
    });
    await _dio.post('/staff/$id/photo', data: formData);
  }

  Future<void> uploadStaffDocument(
    String id, {
    required String filePath,
    required String documentType,
  }) async {
    final formData = FormData.fromMap({
      'documentType': documentType,
      'document': await MultipartFile.fromFile(filePath),
    });
    await _dio.post('/staff/$id/documents', data: formData);
  }

  Future<List<Map<String, dynamic>>> getStaffHistory(String id) async {
    final response = await _dio.get('/staff/$id/history');
    return _parseList(response.data, (j) => j);
  }

  Future<List<Map<String, dynamic>>> getStaffDocuments(String id) async {
    final response = await _dio.get('/staff/$id/documents');
    return _parseList(response.data, (j) => j);
  }

  Future<List<AttendanceRecord>> getAttendance(
      {String? date, String? staffId, int? limit}) async {
    final branchId = await _branchId;
    final response = await _dio.get('/staff/attendance', queryParameters: {
      if (branchId.isNotEmpty) 'branch_id': branchId,
      if (date != null) 'date': date,
      if (staffId != null) 'staff_id': staffId,
      if (limit != null) 'limit': limit,
    });
    return _parseList(response.data, AttendanceRecord.fromJson);
  }

  Future<Map<String, dynamic>> getAttendanceSummary({String? staffId}) async {
    final response = await _dio.get('/staff/attendance/summary',
        queryParameters: {if (staffId != null) 'staff_id': staffId});
    final data = response.data is Map && response.data['data'] != null
        ? response.data['data']
        : response.data;
    return Map<String, dynamic>.from(data ?? {});
  }

  Future<List<Map<String, dynamic>>> getAttendanceReports({
    String? date,
    String? staffId,
    String? status,
  }) async {
    final branchId = await _branchId;
    final response =
        await _dio.get('/staff/attendance/reports', queryParameters: {
      if (branchId.isNotEmpty) 'branch_id': branchId,
      if (date != null) 'date': date,
      if (staffId != null) 'staff_id': staffId,
      if (status != null) 'status': status,
    });
    return _parseList(response.data, (j) => j);
  }

  Future<void> approveAttendance(String id,
      {bool approved = true, String? reason}) async {
    await _dio.put('/staff/attendance/$id/approve', data: {
      'approved': approved,
      if (reason != null && reason.isNotEmpty) 'rejection_reason': reason,
    });
  }

  Future<List<LeaveRequest>> getLeaveRequests(
      {String? status, String? staffId}) async {
    final branchId = await _branchId;
    final response = await _dio.get('/staff/leave', queryParameters: {
      if (branchId.isNotEmpty) 'branch_id': branchId,
      if (status != null) 'status': status,
      if (staffId != null) 'staff_id': staffId,
    });
    return _parseList(response.data, LeaveRequest.fromJson);
  }

  Future<void> approveLeave(String id) async {
    await _dio.put('/staff/leave/$id/approve');
  }

  Future<void> rejectLeave(String id) async {
    await _dio.put('/staff/leave/$id/reject');
  }

  Future<void> reportToDuty(String id, Map<String, dynamic> data) async {
    await _dio.put('/staff/leave/$id/report-to-duty', data: data);
  }

  Future<void> updateSalary(String staffId, num salary) async {
    await updateStaff(staffId, {'basic_salary': salary});
  }

  Future<void> createShift(Map<String, dynamic> data) async {
    final branchId = await _branchId;
    final staffValue = data['staff_id'] ?? data['staff'] ?? data['staff_name'];
    await _dio.post('/staff/schedules', data: {
      'staff': staffValue is List ? staffValue : [staffValue],
      'shift': data['shift'] ?? data['shift_type'],
      'date': data['date'] ?? DateTime.now().toIso8601String().split('T').first,
      'notes': data['notes'],
      'start_time': data['start_time'],
      'end_time': data['end_time'],
      if (branchId.isNotEmpty) 'branch_id': branchId,
    });
  }

  Future<List<ShiftSchedule>> getShifts({String? date}) async {
    final branchId = await _branchId;
    final response = await _dio.get('/staff/schedules', queryParameters: {
      if (branchId.isNotEmpty) 'branch_id': branchId,
      if (date != null) 'date': date,
    });
    return _parseList(response.data, ShiftSchedule.fromJson);
  }

  Future<List<PayrollRecord>> getPayroll(
      {String? period, String? status}) async {
    final branchId = await _branchId;
    final response = await _dio.get('/payroll/history', queryParameters: {
      if (branchId.isNotEmpty) 'branch_id': branchId,
      if (period != null) 'period': period,
      if (status != null) 'status': status,
    });
    return _parseList(response.data, PayrollRecord.fromJson);
  }

  Future<Map<String, dynamic>> getPayrollDraft({
    required int month,
    required int year,
  }) async {
    final branchId = await _branchId;
    final response = await _dio.get('/payroll/draft', queryParameters: {
      if (branchId.isNotEmpty) 'branch_id': branchId,
      'month': month,
      'year': year,
    });
    final data = response.data is Map && response.data['data'] != null
        ? response.data['data']
        : response.data;
    return Map<String, dynamic>.from(data ?? {});
  }

  Future<void> processPayroll({String? period}) async {
    final branchId = await _branchId;
    final now = DateTime.now();
    await _dio.post('/payroll/generate', data: {
      if (branchId.isNotEmpty) 'branch_id': branchId,
      'month':
          period == null ? now.month : int.tryParse(period.split('-').last),
      'year': period == null ? now.year : int.tryParse(period.split('-').first),
    });
  }

  Future<void> approvePayroll(String id) async {
    await _dio.post('/payroll/approve', data: {'run_id': id});
  }

  Future<File> downloadPayrollRunFile(
      String runId, String type, String filename) async {
    final branchId = await _branchId;
    final endpoint = type == 'summary'
        ? '/payroll/run/$runId/summary-pdf'
        : '/payroll/run/$runId/payslips-zip';
    final response = await _dio.get<List<int>>(
      endpoint,
      queryParameters: {if (branchId.isNotEmpty) 'branch_id': branchId},
      options: Options(responseType: ResponseType.bytes),
    );
    final directory = await getDownloadsDirectory() ??
        await getApplicationDocumentsDirectory();
    final safeName = filename.replaceAll(RegExp(r'[^A-Za-z0-9._-]'), '_');
    final file = File('${directory.path}/$safeName');
    await file.writeAsBytes(response.data ?? const <int>[], flush: true);
    return file;
  }

  Future<dynamic> getRaw(String endpoint,
      {Map<String, dynamic> queryParameters = const {}}) async {
    final branchId = await _branchId;
    final response = await _dio.get(endpoint, queryParameters: {
      if (branchId.isNotEmpty) 'branch_id': branchId,
      ...queryParameters,
    });
    return response.data;
  }

  Future<dynamic> submitAction(String method, String endpoint,
      {Map<String, dynamic> data = const {},
      Map<String, dynamic> queryParameters = const {}}) async {
    final response = switch (method.toUpperCase()) {
      'PUT' =>
        await _dio.put(endpoint, data: data, queryParameters: queryParameters),
      'PATCH' => await _dio.patch(endpoint,
          data: data, queryParameters: queryParameters),
      'DELETE' => await _dio.delete(endpoint,
          data: data, queryParameters: queryParameters),
      _ =>
        await _dio.post(endpoint, data: data, queryParameters: queryParameters),
    };
    return response.data;
  }

  // Performance
  Future<Map<String, dynamic>> getStaffPerformanceMetrics({
    required int month,
    required int year,
  }) async {
    final branchId = await _branchId;
    final response =
        await _dio.get('/performance/staff-metrics', queryParameters: {
      'month': month,
      'year': year,
      if (branchId.isNotEmpty) 'branch_id': branchId,
    });
    final data = response.data is Map && response.data['data'] != null
        ? response.data['data']
        : response.data;
    if (data is List) {
      return {'performance': data};
    }
    if (data is Map) return Map<String, dynamic>.from(data);
    return {'performance': const <Map<String, dynamic>>[]};
  }

  Future<List<Map<String, dynamic>>> getPerformanceReviews(
      {String? staffId}) async {
    final branchId = await _branchId;
    final response = await _dio.get('/staff/performance', queryParameters: {
      if (branchId.isNotEmpty) 'branch_id': branchId,
      if (staffId != null) 'staff_id': staffId,
    });
    return _parseList(response.data, (j) => j);
  }

  Future<void> createPerformanceReview(Map<String, dynamic> data) async {
    await _dio.post('/staff/performance', data: data);
  }

  // Salary Adjustments
  Future<List<Map<String, dynamic>>> getSalaryAdjustments({
    String? status,
    String? staffId,
    String? type,
    int? month,
    int? year,
  }) async {
    final branchId = await _branchId;
    final response = await _dio.get('/payroll-adjustments', queryParameters: {
      if (branchId.isNotEmpty) 'branch_id': branchId,
      if (status != null) 'status': status,
      if (staffId != null) 'staff_id': staffId,
      if (type != null) 'type': type,
      if (month != null) 'month': month,
      if (year != null) 'year': year,
    });
    return _parseList(response.data, (j) => j);
  }

  Future<void> createSalaryAdjustment(Map<String, dynamic> data) async {
    await _dio.post('/payroll-adjustments', data: data);
  }

  Future<void> approveSalaryAdjustment(String id) async {
    await _dio.patch('/payroll-adjustments/$id/approve');
  }

  Future<void> rejectSalaryAdjustment(String id) async {
    await _dio.patch('/payroll-adjustments/$id/reject');
  }

  Future<void> voidSalaryAdjustment(String id) async {
    await _dio.patch('/payroll-adjustments/$id/void');
  }

  // HR Reports
  Future<List<Map<String, dynamic>>> getHRReports() async {
    final branchId = await _branchId;
    final response = await _dio.get('/hr-reports', queryParameters: {
      if (branchId.isNotEmpty) 'branch_id': branchId,
    });
    return _parseList(response.data, (j) => j);
  }

  // Payroll Policies
  Future<List<Map<String, dynamic>>> getPayrollPolicies() async {
    final response = await _dio.get('/payroll-policies');
    return _parseList(response.data, (j) => j);
  }

  Future<void> updatePayrollPolicy(String id, Map<String, dynamic> data) async {
    await _dio.put('/payroll-policies/$id', data: data);
  }

  Future<void> createPayrollPolicy(Map<String, dynamic> data) async {
    await _dio.post('/payroll-policies', data: data);
  }

  Future<void> deletePayrollPolicy(String id) async {
    await _dio.delete('/payroll-policies/$id');
  }
}
