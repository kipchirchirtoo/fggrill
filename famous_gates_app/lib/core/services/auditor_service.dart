import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../network/dio_client.dart';
import 'api_service.dart';

final auditorServiceProvider = Provider<AuditorService>((ref) {
  return AuditorService(ref.watch(dioProvider));
});

class AuditorService extends BaseApiService {
  AuditorService(super.dio);

  // ==================== AUDITOR DASHBOARD ====================

  // GET /api/auditor/dashboard
  Future<Map<String, dynamic>> getDashboard({int? branchId}) async {
    final query = {if (branchId != null) 'branchId': branchId};
    final response = await get<Map<String, dynamic>>('/auditor/dashboard',
        queryParameters: query);
    return response;
  }

  // ==================== NIGHT AUDIT ====================

  // GET /api/auditor/night-audit/status
  Future<Map<String, dynamic>> getNightAuditStatus({int? branchId}) async {
    final query = {if (branchId != null) 'branchId': branchId};
    final response = await get<Map<String, dynamic>>(
        '/auditor/night-audit/status',
        queryParameters: query);
    return response;
  }

  // POST /api/auditor/night-audit/start
  Future<Map<String, dynamic>> startNightAudit({int? branchId}) async {
    final response = await post<Map<String, dynamic>>(
      '/auditor/night-audit/start',
      data: {if (branchId != null) 'branchId': branchId},
    );
    return response;
  }

  // POST /api/auditor/night-audit/complete
  Future<Map<String, dynamic>> completeNightAudit(
      {int? branchId, String? notes}) async {
    final response = await post<Map<String, dynamic>>(
      '/auditor/night-audit/complete',
      data: {
        if (branchId != null) 'branchId': branchId,
        if (notes != null) 'notes': notes,
      },
    );
    return response;
  }

  // GET /api/auditor/night-audit/exceptions
  Future<Map<String, dynamic>> getNightAuditExceptions({
    String? auditId,
    String? status,
    int? branchId,
  }) async {
    final query = {
      if (auditId != null) 'auditId': auditId,
      if (status != null) 'status': status,
      if (branchId != null) 'branchId': branchId,
    };
    final response = await get<Map<String, dynamic>>(
        '/auditor/night-audit/exceptions',
        queryParameters: query);
    return response;
  }

  // POST /api/auditor/night-audit/exceptions/:id/resolve
  Future<Map<String, dynamic>> resolveException(String id,
      {String? resolution}) async {
    final response = await post<Map<String, dynamic>>(
      '/auditor/night-audit/exceptions/$id/resolve',
      data: {if (resolution != null) 'resolution': resolution},
    );
    return response;
  }

  // ==================== VOID BILLS ====================

  // GET /api/auditor-void-bills
  Future<Map<String, dynamic>> getVoidBills({
    String? status,
    String? startDate,
    String? endDate,
    int? branchId,
    int page = 1,
    int limit = 50,
  }) async {
    final query = {
      if (status != null) 'status': status,
      if (startDate != null) 'startDate': startDate,
      if (endDate != null) 'endDate': endDate,
      if (branchId != null) 'branchId': branchId,
      'page': page,
      'limit': limit,
    };
    final response = await get<Map<String, dynamic>>('/auditor-void-bills',
        queryParameters: query);
    return response;
  }

  // GET /api/auditor-void-bills/:id
  Future<Map<String, dynamic>> getVoidBill(String id) async {
    final response = await get<Map<String, dynamic>>('/auditor-void-bills/$id');
    return response;
  }

  // POST /api/auditor-void-bills/:id/approve
  Future<Map<String, dynamic>> approveVoidBill(String id,
      {String? notes}) async {
    final response = await post<Map<String, dynamic>>(
      '/auditor-void-bills/$id/approve',
      data: {if (notes != null) 'notes': notes},
    );
    return response;
  }

  // POST /api/auditor-void-bills/:id/reject
  Future<Map<String, dynamic>> rejectVoidBill(String id,
      {String? reason}) async {
    final response = await post<Map<String, dynamic>>(
      '/auditor-void-bills/$id/reject',
      data: {if (reason != null) 'reason': reason},
    );
    return response;
  }

  // ==================== AUDITOR REPORTS ====================

  // GET /api/auditor-reports
  Future<Map<String, dynamic>> getAuditorReports({
    String? type,
    String? startDate,
    String? endDate,
    int? branchId,
  }) async {
    final query = {
      if (type != null) 'type': type,
      if (startDate != null) 'startDate': startDate,
      if (endDate != null) 'endDate': endDate,
      if (branchId != null) 'branchId': branchId,
    };
    final response = await get<Map<String, dynamic>>('/auditor-reports',
        queryParameters: query);
    return response;
  }

  // GET /api/auditor-reports/:id
  Future<Map<String, dynamic>> getAuditorReport(String id) async {
    final response = await get<Map<String, dynamic>>('/auditor-reports/$id');
    return response;
  }

  // POST /api/auditor-reports
  Future<Map<String, dynamic>> createAuditorReport(
      Map<String, dynamic> report) async {
    final response =
        await post<Map<String, dynamic>>('/auditor-reports', data: report);
    return response;
  }

  // ==================== REVENUE CHECKS ====================

  // GET /api/auditor/revenue-checks
  Future<Map<String, dynamic>> getRevenueChecks({
    String? date,
    String? status,
    int? branchId,
  }) async {
    final query = {
      if (date != null) 'date': date,
      if (status != null) 'status': status,
      if (branchId != null) 'branchId': branchId,
    };
    final response = await get<Map<String, dynamic>>('/auditor/revenue-checks',
        queryParameters: query);
    return response;
  }

  // POST /api/auditor/revenue-checks
  Future<Map<String, dynamic>> createRevenueCheck(
      Map<String, dynamic> check) async {
    final response = await post<Map<String, dynamic>>('/auditor/revenue-checks',
        data: check);
    return response;
  }

  // POST /api/auditor/revenue-checks/:id/verify
  Future<Map<String, dynamic>> verifyRevenue(String id) async {
    final response =
        await post<Map<String, dynamic>>('/auditor/revenue-checks/$id/verify');
    return response;
  }

  // ==================== DISCREPANCIES ====================

  // GET /api/auditor/discrepancies
  Future<Map<String, dynamic>> getDiscrepancies({
    String? type,
    String? status,
    String? startDate,
    String? endDate,
    int? branchId,
    int page = 1,
    int limit = 50,
  }) async {
    final query = {
      if (type != null) 'type': type,
      if (status != null) 'status': status,
      if (startDate != null) 'startDate': startDate,
      if (endDate != null) 'endDate': endDate,
      if (branchId != null) 'branchId': branchId,
      'page': page,
      'limit': limit,
    };
    final response = await get<Map<String, dynamic>>('/auditor/discrepancies',
        queryParameters: query);
    return response;
  }

  // POST /api/auditor/discrepancies/:id/investigate
  Future<Map<String, dynamic>> investigateDiscrepancy(String id,
      {String? notes}) async {
    final response = await post<Map<String, dynamic>>(
      '/auditor/discrepancies/$id/investigate',
      data: {if (notes != null) 'notes': notes},
    );
    return response;
  }

  // POST /api/auditor/discrepancies/:id/resolve
  Future<Map<String, dynamic>> resolveDiscrepancy(String id,
      {String? resolution}) async {
    final response = await post<Map<String, dynamic>>(
      '/auditor/discrepancies/$id/resolve',
      data: {if (resolution != null) 'resolution': resolution},
    );
    return response;
  }

  // ==================== CASHIER CLEARANCE ====================

  // GET /api/cashier-clearance
  Future<Map<String, dynamic>> getCashierClearances({
    String? status,
    String? date,
    int? branchId,
  }) async {
    final query = {
      if (status != null) 'status': status,
      if (date != null) 'date': date,
      if (branchId != null) 'branchId': branchId,
    };
    final response = await get<Map<String, dynamic>>('/cashier-clearance',
        queryParameters: query);
    return response;
  }

  // POST /api/cashier-clearance
  Future<Map<String, dynamic>> createCashierClearance(
      Map<String, dynamic> clearance) async {
    final response =
        await post<Map<String, dynamic>>('/cashier-clearance', data: clearance);
    return response;
  }

  // POST /api/cashier-clearance/:id/approve
  Future<Map<String, dynamic>> approveCashierClearance(String id,
      {String? notes}) async {
    final response = await post<Map<String, dynamic>>(
      '/cashier-clearance/$id/approve',
      data: {if (notes != null) 'notes': notes},
    );
    return response;
  }

  // ==================== DELIVERIES AUDIT ====================

  // GET /api/auditor/deliveries
  Future<Map<String, dynamic>> getDeliveriesForAudit({
    String? status,
    String? date,
    int? branchId,
    int page = 1,
    int limit = 50,
  }) async {
    final query = {
      if (status != null) 'status': status,
      if (date != null) 'date': date,
      if (branchId != null) 'branchId': branchId,
      'page': page,
      'limit': limit,
    };
    final response = await get<Map<String, dynamic>>('/auditor/deliveries',
        queryParameters: query);
    return response;
  }

  // GET /api/auditor/deliveries/:id
  Future<Map<String, dynamic>> getDeliveryAudit(String id) async {
    final response = await get<Map<String, dynamic>>('/auditor/deliveries/$id');
    return response;
  }

  // POST /api/auditor/deliveries/:id/verify
  Future<Map<String, dynamic>> verifyDelivery(String id) async {
    final response =
        await post<Map<String, dynamic>>('/auditor/deliveries/$id/verify');
    return response;
  }
}
