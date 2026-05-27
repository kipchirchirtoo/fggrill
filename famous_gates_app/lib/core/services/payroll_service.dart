import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../network/dio_client.dart';
import 'api_service.dart';

final payrollServiceProvider = Provider<PayrollService>((ref) {
  return PayrollService(ref.watch(dioProvider));
});

class PayrollService extends BaseApiService {
  PayrollService(super.dio);

  // ==================== PAYROLL ====================

  // GET /api/payroll
  Future<Map<String, dynamic>> getPayroll({
    String? period,
    String? status,
    int? branchId,
    int page = 1,
    int limit = 50,
  }) async {
    final query = {
      if (period != null) 'period': period,
      if (status != null) 'status': status,
      if (branchId != null) 'branchId': branchId,
      'page': page,
      'limit': limit,
    };
    final response =
        await get<Map<String, dynamic>>('/payroll', queryParameters: query);
    return response;
  }

  // GET /api/payroll/:id
  Future<Map<String, dynamic>> getPayrollRecord(String id) async {
    final response = await get<Map<String, dynamic>>('/payroll/$id');
    return response;
  }

  // POST /api/payroll
  Future<Map<String, dynamic>> createPayroll(
      Map<String, dynamic> payroll) async {
    final response =
        await post<Map<String, dynamic>>('/payroll', data: payroll);
    return response;
  }

  // PUT /api/payroll/:id
  Future<Map<String, dynamic>> updatePayroll(
      String id, Map<String, dynamic> payroll) async {
    final response =
        await put<Map<String, dynamic>>('/payroll/$id', data: payroll);
    return response;
  }

  // POST /api/payroll/:id/process
  Future<Map<String, dynamic>> processPayroll(String id) async {
    final response = await post<Map<String, dynamic>>('/payroll/$id/process');
    return response;
  }

  // POST /api/payroll/:id/approve
  Future<Map<String, dynamic>> approvePayroll(String id) async {
    final response = await post<Map<String, dynamic>>('/payroll/$id/approve');
    return response;
  }

  // ==================== PAYROLL SIMPLE ====================

  // GET /api/payroll-simple
  Future<Map<String, dynamic>> getSimplePayroll(
      {String? period, int? branchId}) async {
    final query = {
      if (period != null) 'period': period,
      if (branchId != null) 'branchId': branchId,
    };
    final response = await get<Map<String, dynamic>>('/payroll-simple',
        queryParameters: query);
    return response;
  }

  // POST /api/payroll-simple/calculate
  Future<Map<String, dynamic>> calculateSimplePayroll(
      Map<String, dynamic> data) async {
    final response = await post<Map<String, dynamic>>(
        '/payroll-simple/calculate',
        data: data);
    return response;
  }

  // ==================== PAYROLL ENHANCED ====================

  // GET /api/payroll-enhanced
  Future<Map<String, dynamic>> getEnhancedPayroll(
      {String? period, int? branchId}) async {
    final query = {
      if (period != null) 'period': period,
      if (branchId != null) 'branchId': branchId,
    };
    final response = await get<Map<String, dynamic>>('/payroll-enhanced',
        queryParameters: query);
    return response;
  }

  // GET /api/payroll-enhanced/:id/details
  Future<Map<String, dynamic>> getEnhancedPayrollDetails(String id) async {
    final response =
        await get<Map<String, dynamic>>('/payroll-enhanced/$id/details');
    return response;
  }

  // ==================== PAYROLL ADJUSTMENTS ====================

  // GET /api/payroll-adjustments
  Future<Map<String, dynamic>> getAdjustments({
    String? payrollId,
    String? type,
    int? branchId,
  }) async {
    final query = {
      if (payrollId != null) 'payrollId': payrollId,
      if (type != null) 'type': type,
      if (branchId != null) 'branchId': branchId,
    };
    final response = await get<Map<String, dynamic>>('/payroll-adjustments',
        queryParameters: query);
    return response;
  }

  // POST /api/payroll-adjustments
  Future<Map<String, dynamic>> createAdjustment(
      Map<String, dynamic> adjustment) async {
    final response = await post<Map<String, dynamic>>('/payroll-adjustments',
        data: adjustment);
    return response;
  }

  // ==================== STATUTORY DEDUCTIONS ====================

  // GET /api/statutory-deductions
  Future<Map<String, dynamic>> getStatutoryDeductions(
      {String? period, int? branchId}) async {
    final query = {
      if (period != null) 'period': period,
      if (branchId != null) 'branchId': branchId,
    };
    final response = await get<Map<String, dynamic>>('/statutory-deductions',
        queryParameters: query);
    return response;
  }

  // POST /api/statutory-deductions
  Future<Map<String, dynamic>> recordStatutoryDeduction(
      Map<String, dynamic> deduction) async {
    final response = await post<Map<String, dynamic>>('/statutory-deductions',
        data: deduction);
    return response;
  }

  // ==================== PAYROLL POLICIES ====================

  // GET /api/payroll-policies
  Future<Map<String, dynamic>> getPayrollPolicies({int? branchId}) async {
    final query = {if (branchId != null) 'branchId': branchId};
    final response = await get<Map<String, dynamic>>('/payroll-policies',
        queryParameters: query);
    return response;
  }

  // PUT /api/payroll-policies
  Future<Map<String, dynamic>> updatePayrollPolicies(
      Map<String, dynamic> policies) async {
    final response =
        await put<Map<String, dynamic>>('/payroll-policies', data: policies);
    return response;
  }

  // ==================== EMPLOYEE PAYSLIPS ====================

  // GET /api/payroll/payslips
  Future<Map<String, dynamic>> getPayslips({
    int? employeeId,
    String? period,
    int? branchId,
  }) async {
    final query = {
      if (employeeId != null) 'employeeId': employeeId,
      if (period != null) 'period': period,
      if (branchId != null) 'branchId': branchId,
    };
    final response = await get<Map<String, dynamic>>('/payroll/payslips',
        queryParameters: query);
    return response;
  }

  // GET /api/payroll/payslips/:id
  Future<Map<String, dynamic>> getPayslip(String id) async {
    final response = await get<Map<String, dynamic>>('/payroll/payslips/$id');
    return response;
  }

  // POST /api/payroll/payslips/:id/generate
  Future<Map<String, dynamic>> generatePayslip(String id) async {
    final response =
        await post<Map<String, dynamic>>('/payroll/payslips/$id/generate');
    return response;
  }

  // GET /api/payroll/payslips/:id/download
  Future<Map<String, dynamic>> downloadPayslip(String id) async {
    final response =
        await get<Map<String, dynamic>>('/payroll/payslips/$id/download');
    return response;
  }

  // ==================== PAYROLL REPORTS ====================

  // GET /api/hr-reports/payroll
  Future<Map<String, dynamic>> getPayrollReports({
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
    final response = await get<Map<String, dynamic>>('/hr-reports/payroll',
        queryParameters: query);
    return response;
  }

  // ==================== ATTENDANCE ====================

  // GET /api/attendance
  Future<Map<String, dynamic>> getAttendance({
    String? date,
    int? employeeId,
    int? branchId,
  }) async {
    final query = {
      if (date != null) 'date': date,
      if (employeeId != null) 'employeeId': employeeId,
      if (branchId != null) 'branchId': branchId,
    };
    final response =
        await get<Map<String, dynamic>>('/attendance', queryParameters: query);
    return response;
  }

  // POST /api/attendance/clock-in
  Future<Map<String, dynamic>> clockIn(Map<String, dynamic> data) async {
    final response =
        await post<Map<String, dynamic>>('/attendance/clock-in', data: data);
    return response;
  }

  // POST /api/attendance/clock-out
  Future<Map<String, dynamic>> clockOut(Map<String, dynamic> data) async {
    final response =
        await post<Map<String, dynamic>>('/attendance/clock-out', data: data);
    return response;
  }

  // GET /api/attendance/summary
  Future<Map<String, dynamic>> getAttendanceSummary({
    String? startDate,
    String? endDate,
    int? employeeId,
  }) async {
    final query = {
      if (startDate != null) 'startDate': startDate,
      if (endDate != null) 'endDate': endDate,
      if (employeeId != null) 'employeeId': employeeId,
    };
    final response = await get<Map<String, dynamic>>('/attendance/summary',
        queryParameters: query);
    return response;
  }
}
