import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../network/dio_client.dart';
import 'api_service.dart';

final systemServiceProvider = Provider<SystemService>((ref) {
  return SystemService(ref.watch(dioProvider));
});

class SystemService extends BaseApiService {
  SystemService(super.dio);

  // ==================== BRANCHES ====================

  // GET /api/system/branches
  Future<Map<String, dynamic>> getBranches({
    String? status,
    String? search,
  }) async {
    final query = {
      if (status != null) 'status': status,
      if (search != null) 'search': search,
    };
    final response = await get<Map<String, dynamic>>('/system/branches',
        queryParameters: query);
    return response;
  }

  // GET /api/system/branches/:id
  Future<Map<String, dynamic>> getBranch(int id) async {
    final response = await get<Map<String, dynamic>>('/system/branches/$id');
    return response;
  }

  // POST /api/system/branches
  Future<Map<String, dynamic>> createBranch(Map<String, dynamic> branch) async {
    final response =
        await post<Map<String, dynamic>>('/system/branches', data: branch);
    return response;
  }

  // PUT /api/system/branches/:id
  Future<Map<String, dynamic>> updateBranch(
      int id, Map<String, dynamic> branch) async {
    final response =
        await put<Map<String, dynamic>>('/system/branches/$id', data: branch);
    return response;
  }

  // DELETE /api/system/branches/:id
  Future<Map<String, dynamic>> deleteBranch(int id) async {
    final response =
        await delete<Map<String, dynamic>>('/system/branches/$id');
    return response;
  }

  // PATCH /api/system/branches/:id/status
  Future<Map<String, dynamic>> updateBranchStatus(int id, String status) async {
    final response = await patch<Map<String, dynamic>>(
      '/system/branches/$id/status',
      data: {'status': status},
    );
    return response;
  }

  // GET /api/system/branches/:id/stats
  Future<Map<String, dynamic>> getBranchStats(int id) async {
    final response =
        await get<Map<String, dynamic>>('/system/branches/$id/stats');
    return response;
  }

  // ==================== DEPARTMENTS ====================

  // GET /api/system/departments
  Future<Map<String, dynamic>> getDepartments() async {
    final response = await get<Map<String, dynamic>>('/system/departments');
    return response;
  }

  // GET /api/system/departments/:id
  Future<Map<String, dynamic>> getDepartment(int id) async {
    final response = await get<Map<String, dynamic>>('/system/departments/$id');
    return response;
  }

  // POST /api/system/departments
  Future<Map<String, dynamic>> createDepartment(
      Map<String, dynamic> department) async {
    final response = await post<Map<String, dynamic>>('/system/departments',
        data: department);
    return response;
  }

  // PUT /api/system/departments/:id
  Future<Map<String, dynamic>> updateDepartment(
      int id, Map<String, dynamic> department) async {
    final response = await put<Map<String, dynamic>>('/system/departments/$id',
        data: department);
    return response;
  }

  // DELETE /api/system/departments/:id
  Future<Map<String, dynamic>> deleteDepartment(int id) async {
    final response =
        await delete<Map<String, dynamic>>('/system/departments/$id');
    return response;
  }

  // ==================== ROLES ====================

  // GET /api/system/roles
  Future<Map<String, dynamic>> getRoles() async {
    final response = await get<Map<String, dynamic>>('/system/roles');
    return response;
  }

  // GET /api/system/roles/:id
  Future<Map<String, dynamic>> getRole(String id) async {
    final response = await get<Map<String, dynamic>>('/system/roles/$id');
    return response;
  }

  // POST /api/system/roles
  Future<Map<String, dynamic>> createRole(Map<String, dynamic> role) async {
    final response =
        await post<Map<String, dynamic>>('/system/roles', data: role);
    return response;
  }

  // PUT /api/system/roles/:id
  Future<Map<String, dynamic>> updateRole(
      String id, Map<String, dynamic> role) async {
    final response =
        await put<Map<String, dynamic>>('/system/roles/$id', data: role);
    return response;
  }

  // DELETE /api/system/roles/:id
  Future<Map<String, dynamic>> deleteRole(String id) async {
    final response = await delete<Map<String, dynamic>>('/system/roles/$id');
    return response;
  }

  // POST /api/system/roles/:id/permissions
  Future<Map<String, dynamic>> updateRolePermissions(
      String id, List<String> permissions) async {
    final response = await post<Map<String, dynamic>>(
      '/system/roles/$id/permissions',
      data: {'permissions': permissions},
    );
    return response;
  }

  // ==================== SYSTEM CONFIG ====================

  // GET /api/system/config
  Future<Map<String, dynamic>> getSystemConfig() async {
    final response = await get<Map<String, dynamic>>('/system/config');
    return response;
  }

  // PUT /api/system/config
  Future<Map<String, dynamic>> updateSystemConfig(
      Map<String, dynamic> config) async {
    final response =
        await put<Map<String, dynamic>>('/system/config', data: config);
    return response;
  }

  // GET /api/system/config/email
  Future<Map<String, dynamic>> getEmailConfig() async {
    final response = await get<Map<String, dynamic>>('/system/config/email');
    return response;
  }

  // PUT /api/system/config/email
  Future<Map<String, dynamic>> updateEmailConfig(
      Map<String, dynamic> config) async {
    final response =
        await put<Map<String, dynamic>>('/system/config/email', data: config);
    return response;
  }

  // GET /api/system/config/payment
  Future<Map<String, dynamic>> getPaymentConfig() async {
    final response = await get<Map<String, dynamic>>('/system/config/payment');
    return response;
  }

  // PUT /api/system/config/payment
  Future<Map<String, dynamic>> updatePaymentConfig(
      Map<String, dynamic> config) async {
    final response =
        await put<Map<String, dynamic>>('/system/config/payment', data: config);
    return response;
  }

  // GET /api/system/config/backup
  Future<Map<String, dynamic>> getBackupConfig() async {
    final response = await get<Map<String, dynamic>>('/system/config/backup');
    return response;
  }

  // PUT /api/system/config/backup
  Future<Map<String, dynamic>> updateBackupConfig(
      Map<String, dynamic> config) async {
    final response =
        await put<Map<String, dynamic>>('/system/config/backup', data: config);
    return response;
  }

  // ==================== NOTIFICATIONS ====================

  // GET /api/notifications
  Future<Map<String, dynamic>> getNotifications({
    String? type,
    bool? isRead,
    int page = 1,
    int limit = 50,
  }) async {
    final query = {
      if (type != null) 'type': type,
      if (isRead != null) 'is_read': isRead.toString(),
      'page': page,
      'limit': limit,
    };
    final response = await get<Map<String, dynamic>>('/notifications',
        queryParameters: query);
    return response;
  }

  // GET /api/notifications/unread-count
  Future<Map<String, dynamic>> getUnreadCount() async {
    final response =
        await get<Map<String, dynamic>>('/notifications/unread-count');
    return response;
  }

  // PATCH /api/notifications/:id/read
  Future<Map<String, dynamic>> markAsRead(String id) async {
    final response =
        await patch<Map<String, dynamic>>('/notifications/$id/read');
    return response;
  }

  // PATCH /api/notifications/mark-all-read
  Future<Map<String, dynamic>> markAllAsRead() async {
    final response =
        await patch<Map<String, dynamic>>('/notifications/mark-all-read');
    return response;
  }

  // DELETE /api/notifications/:id
  Future<Map<String, dynamic>> deleteNotification(String id) async {
    final response = await delete<Map<String, dynamic>>('/notifications/$id');
    return response;
  }

  // ==================== SYSTEM HEALTH ====================

  // GET /api/health
  Future<Map<String, dynamic>> getHealthStatus() async {
    final response = await get<Map<String, dynamic>>('/health');
    return response;
  }

  // GET /api/system/status
  // Gracefully returns a "not deployed yet" placeholder when the server
  // returns 404/405, or is unreachable (timeout / connection error).
  // Only propagates unexpected server errors (5xx etc.) as real failures.
  Future<Map<String, dynamic>> getSystemStatus() async {
    try {
      final response = await get<Map<String, dynamic>>('/system/status');
      return response;
    } on DioException catch (e) {
      final code = e.response?.statusCode;
      // Not deployed / method not allowed → safe placeholder.
      if (code == 404 || code == 405) {
        return _unavailableStatus('Route not deployed on server');
      }
      // Network-level failures (timeout, no connection) → treat as degraded
      // rather than crashing the System Health section with a 30-second wait.
      if (e.type == DioExceptionType.connectionTimeout ||
          e.type == DioExceptionType.receiveTimeout ||
          e.type == DioExceptionType.sendTimeout ||
          e.type == DioExceptionType.connectionError ||
          e.type == DioExceptionType.unknown) {
        return _unavailableStatus('Server not reachable: ${e.type.name}');
      }
      rethrow;
    }
  }

  static Map<String, dynamic> _unavailableStatus([String reason = '']) => {
        'success': false,
        '_unavailable': true,
        '_reason': reason,
        'database': {'status': 'unavailable', 'latency': 'N/A'},
        'api': {'status': 'unavailable'},
        'cache': {'status': 'N/A'},
        'queue': {'status': 'N/A'},
        'uptime': 'N/A',
        'cpu': 0,
        'memory': 0,
        'disk': 0,
        'connections': 0,
      };

  // POST /api/system/maintenance
  Future<Map<String, dynamic>> toggleMaintenanceMode(bool enabled) async {
    final response = await post<Map<String, dynamic>>(
      '/system/maintenance',
      data: {'enabled': enabled},
    );
    return response;
  }

  // ==================== AUDIT LOGS ====================

  // GET /api/audit
  Future<Map<String, dynamic>> getAuditLogs({
    String? entity,
    String? action,
    String? userId,
    String? startDate,
    String? endDate,
    int page = 1,
    int limit = 50,
  }) async {
    final query = {
      if (entity != null) 'entity': entity,
      if (action != null) 'action': action,
      if (userId != null) 'userId': userId,
      if (startDate != null) 'startDate': startDate,
      if (endDate != null) 'endDate': endDate,
      'page': page,
      'limit': limit,
    };
    final response =
        await get<Map<String, dynamic>>('/audit', queryParameters: query);
    return response;
  }

  // GET /api/audit/:id
  Future<Map<String, dynamic>> getAuditLog(String id) async {
    final response = await get<Map<String, dynamic>>('/audit/$id');
    return response;
  }

  // ==================== SYSTEM LOGS ====================

  // GET /api/admin-logs (backend route)
  Future<Map<String, dynamic>> getAdminLogs({
    String? category,
    String? level,
    String? startDate,
    String? endDate,
    int page = 1,
    int limit = 50,
  }) async {
    final query = {
      if (category != null) 'category': category,
      if (level != null) 'level': level,
      if (startDate != null) 'startDate': startDate,
      if (endDate != null) 'endDate': endDate,
      'page': page,
      'limit': limit,
    };
    final response =
        await get<Map<String, dynamic>>('/admin-logs', queryParameters: query);
    return response;
  }

  // GET /api/admin-logs/overview
  Future<Map<String, dynamic>> getLogsOverview() async {
    final response = await get<Map<String, dynamic>>('/admin-logs/overview');
    return response;
  }
}
