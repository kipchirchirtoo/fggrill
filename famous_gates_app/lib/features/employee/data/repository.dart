import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/network/dio_client.dart';

final employeePortalRepositoryProvider =
    Provider<EmployeePortalRepository>((ref) {
  return EmployeePortalRepository(ref.read(dioProvider));
});

class EmployeePortalRepository {
  final Dio _dio;
  EmployeePortalRepository(this._dio);

  Future<Map<String, dynamic>> getDashboard() async {
    final res = await _dio.get('/employee-portal/dashboard');
    final data = res.data;
    return data is Map<String, dynamic>
        ? data
        : (data is Map ? Map<String, dynamic>.from(data) : {});
  }

  Future<List<Map<String, dynamic>>> getSchedules(
      {String? startDate, String? endDate}) async {
    final res = await _dio.get('/employee-portal/schedules', queryParameters: {
      if (startDate != null) 'start_date': startDate,
      if (endDate != null) 'end_date': endDate,
    });
    final data = res.data;
    final list =
        data is List ? data : (data is Map ? (data['data'] ?? []) : []);
    return (list as List)
        .whereType<Map>()
        .map((e) => Map<String, dynamic>.from(e))
        .toList();
  }

  Future<Map<String, dynamic>> getProfile() async {
    final res = await _dio.get('/employee-portal/profile');
    final data = res.data;
    return data is Map<String, dynamic>
        ? data
        : (data is Map ? Map<String, dynamic>.from(data) : {});
  }

  Future<List<Map<String, dynamic>>> getTimeClock(
      {String? startDate, String? endDate}) async {
    return _getList('/employee-portal/time-clock', {
      if (startDate != null) 'start_date': startDate,
      if (endDate != null) 'end_date': endDate,
    });
  }

  Future<void> clock(String action, {String? notes}) async {
    await _dio.post('/employee-portal/clock', data: {
      'action': action,
      if (notes != null) 'notes': notes,
    });
  }

  Future<List<Map<String, dynamic>>> getLeaveRequests() =>
      _getList('/employee-portal/leave');
  Future<List<Map<String, dynamic>>> getTasks({String? status}) =>
      _getList('/employee-portal/tasks', {
        if (status != null) 'status': status,
      });
  Future<List<Map<String, dynamic>>> getPayslips() =>
      _getList('/employee-portal/payslips');
  Future<List<Map<String, dynamic>>> getDocuments() =>
      _getList('/employee-portal/documents');
  Future<List<Map<String, dynamic>>> getAnnouncements() =>
      _getList('/employee-portal/announcements');
  Future<List<Map<String, dynamic>>> getTraining() =>
      _getList('/employee-portal/training');
  Future<List<Map<String, dynamic>>> getPerformance() =>
      _getList('/employee-portal/performance');

  Future<List<Map<String, dynamic>>> _getList(String path,
      [Map<String, dynamic>? query]) async {
    final res = await _dio.get(path, queryParameters: query);
    final data = res.data;
    final list = data is List
        ? data
        : (data is Map ? (data['data'] ?? data['items'] ?? []) : []);
    return (list as List)
        .whereType<Map>()
        .map((e) => Map<String, dynamic>.from(e))
        .toList();
  }
}
