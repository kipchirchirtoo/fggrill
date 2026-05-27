import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../network/dio_client.dart';
import 'api_service.dart';

final securityServiceProvider = Provider<SecurityService>((ref) {
  return SecurityService(ref.watch(dioProvider));
});

class SecurityService extends BaseApiService {
  SecurityService(super.dio);

  // ==================== SECURITY LOGS ====================
  // Note: Security logs are fetched from admin-logs endpoint

  // GET /api/admin-logs?category=security
  Future<Map<String, dynamic>> getSecurityLogs({
    String? status,
    String? threatLevel,
    String? ipAddress,
    String? search,
    String? startDate,
    String? endDate,
    int page = 1,
    int limit = 50,
  }) async {
    final query = {
      'category': 'security',
      if (status != null) 'status': status,
      if (threatLevel != null) 'threatLevel': threatLevel,
      if (ipAddress != null) 'ipAddress': ipAddress,
      if (search != null && search.isNotEmpty) 'search': search,
      if (startDate != null) 'startDate': startDate,
      if (endDate != null) 'endDate': endDate,
      'page': page,
      'limit': limit,
    };
    final response =
        await get<Map<String, dynamic>>('/admin-logs', queryParameters: query);
    return response;
  }

  // ==================== IP BLOCKING ====================

  // GET /api/security/blocked-ips
  Future<Map<String, dynamic>> getBlockedIPs(
      {int page = 1, int limit = 50}) async {
    final query = {'page': page, 'limit': limit};
    final response = await get<Map<String, dynamic>>('/security/blocked-ips',
        queryParameters: query);
    return response;
  }

  // POST /api/security/block-ip
  Future<Map<String, dynamic>> blockIP(String ipAddress, String reason) async {
    final response = await post<Map<String, dynamic>>(
      '/security/block-ip',
      data: {'ip_address': ipAddress, 'reason': reason},
    );
    return response;
  }

  // POST /api/security/unblock-ip
  Future<Map<String, dynamic>> unblockIP(String ipAddress) async {
    final response = await post<Map<String, dynamic>>(
      '/security/unblock-ip',
      data: {'ip_address': ipAddress},
    );
    return response;
  }

  // ==================== SECURITY STATS ====================
  // Note: Using api-metrics endpoint for security stats

  // GET /api/admin-logs/overview
  Future<Map<String, dynamic>> getSecurityStats({String? period}) async {
    final response = await get<Map<String, dynamic>>('/admin-logs/overview');
    return response;
  }

  // GET /api/security/active-sessions
  Future<Map<String, dynamic>> getActiveSessions() async {
    final response =
        await get<Map<String, dynamic>>('/security/active-sessions');
    return response;
  }

  // POST /api/security/terminate-session
  Future<Map<String, dynamic>> terminateSession(String userId,
      {String? sessionId}) async {
    final response = await post<Map<String, dynamic>>(
      '/security/terminate-session',
      data: {
        'user_id': userId,
        if (sessionId != null) 'session_id': sessionId,
      },
    );
    return response;
  }

  // POST /api/security/terminate-all-sessions
  Future<Map<String, dynamic>> terminateAllSessions() async {
    final response =
        await post<Map<String, dynamic>>('/security/terminate-all-sessions');
    return response;
  }

  // GET /api/admin-ai/anomalies (AI detected threats)
  Future<Map<String, dynamic>> getThreats({
    String? severity,
    String? status,
    int page = 1,
    int limit = 50,
  }) async {
    final query = {
      if (severity != null) 'severity': severity,
      if (status != null) 'status': status,
      'page': page,
      'limit': limit,
    };
    final response = await get<Map<String, dynamic>>('/admin-ai/anomalies',
        queryParameters: query);
    return response;
  }

  // ==================== RLS POLICIES ====================

  // GET /api/security/rls-policies
  Future<Map<String, dynamic>> getRLSPolicies({String? tableName}) async {
    final query = {if (tableName != null) 'tableName': tableName};
    final response = await get<Map<String, dynamic>>('/security/rls-policies',
        queryParameters: query);
    return response;
  }

  // GET /api/security/rls-policies/check
  Future<Map<String, dynamic>> checkRLSPolicy(
      String tableName, String action) async {
    final response = await get<Map<String, dynamic>>(
      '/security/rls-policies/check',
      queryParameters: {'tableName': tableName, 'action': action},
    );
    return response;
  }

  // ==================== API SECURITY ====================

  // GET /api/security/api-metrics (correct backend endpoint)
  Future<Map<String, dynamic>> getAPILogs({
    String? endpoint,
    String? method,
    String? statusCode,
    String? startDate,
    String? endDate,
    int page = 1,
    int limit = 50,
  }) async {
    final query = {
      if (endpoint != null) 'endpoint': endpoint,
      if (method != null) 'method': method,
      if (statusCode != null) 'statusCode': statusCode,
      if (startDate != null) 'startDate': startDate,
      if (endDate != null) 'endDate': endDate,
      'page': page,
      'limit': limit,
    };
    final response = await get<Map<String, dynamic>>('/security/api-metrics',
        queryParameters: query);
    return response;
  }

  // ==================== SECURITY CONFIG ====================

  // GET /api/security/config
  Future<Map<String, dynamic>> getSecurityConfig() async {
    final response = await get<Map<String, dynamic>>('/security/config');
    return response;
  }

  // PUT /api/security/config
  Future<Map<String, dynamic>> updateSecurityConfig(
      Map<String, dynamic> config) async {
    final response =
        await put<Map<String, dynamic>>('/security/config', data: config);
    return response;
  }

  // ==================== ANOMALIES (AI) ====================
  // Routes are /api/admin-ai/* not /api/admin/ai/*

  // GET /api/admin-ai/anomalies
  Future<Map<String, dynamic>> getAnomalies({
    String? severity,
    String? category,
    String? startDate,
    String? endDate,
    int? limit,
  }) async {
    final query = {
      if (severity != null) 'severity': severity,
      if (category != null) 'category': category,
      if (startDate != null) 'startDate': startDate,
      if (endDate != null) 'endDate': endDate,
      if (limit != null) 'limit': limit,
    };
    final response = await get<Map<String, dynamic>>('/admin-ai/anomalies',
        queryParameters: query);
    return response;
  }

  // GET /api/admin-ai/insights
  Future<Map<String, dynamic>> getAIInsights() async {
    final response = await get<Map<String, dynamic>>('/admin-ai/insights');
    return response;
  }

  // POST /api/admin-ai/retrain
  Future<Map<String, dynamic>> retrainAIModels() async {
    final response = await post<Map<String, dynamic>>('/admin-ai/retrain');
    return response;
  }

  // GET /api/admin-ai/stats - Note: backend doesn't have this, using anomalies count
  Future<Map<String, dynamic>> getAIStats() async {
    final response =
        await get<Map<String, dynamic>>('/admin-ai/anomalies?limit=1');
    return {'count': response['count'] ?? 0};
  }
}
