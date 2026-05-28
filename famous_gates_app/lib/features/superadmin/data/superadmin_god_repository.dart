import 'package:dio/dio.dart';

class SuperadminGodRepository {
  final Dio _dio;
  SuperadminGodRepository(this._dio);

  // Feature Flags
  Future<List<Map<String, dynamic>>> getFeatureFlags() async {
    final r = await _dio.get('/superadmin/feature-flags');
    final data = r.data['data'] ?? r.data;
    return List<Map<String, dynamic>>.from(data is List ? data : []);
  }

  Future<void> createFeatureFlag(Map<String, dynamic> body) async {
    await _dio.post('/superadmin/feature-flags', data: body);
  }

  Future<void> updateFeatureFlag(int id, Map<String, dynamic> body) async {
    await _dio.put('/superadmin/feature-flags/$id', data: body);
  }

  Future<void> deleteFeatureFlag(int id) async {
    await _dio.delete('/superadmin/feature-flags/$id');
  }

  // Announcements
  Future<List<Map<String, dynamic>>> getAnnouncements() async {
    final r = await _dio.get('/superadmin/announcements');
    final data = r.data['data'] ?? r.data;
    return List<Map<String, dynamic>>.from(data is List ? data : []);
  }

  Future<void> createAnnouncement(Map<String, dynamic> body) async {
    await _dio.post('/superadmin/announcements', data: body);
  }

  Future<void> deleteAnnouncement(String id) async {
    await _dio.delete('/superadmin/announcements/$id');
  }

  // Security Config
  Future<Map<String, dynamic>> getSecurityConfig() async {
    final r = await _dio.get('/superadmin/config/security');
    return Map<String, dynamic>.from(r.data['data'] ?? r.data);
  }

  Future<void> updateSecurityConfig(Map<String, dynamic> body) async {
    await _dio.put('/superadmin/config/security', data: body);
  }

  // Impersonation
  Future<Map<String, dynamic>> startImpersonation(
      String userId, String justification) async {
    final r = await _dio.post('/superadmin/impersonate/$userId',
        data: {'justification': justification});
    return Map<String, dynamic>.from(r.data);
  }

  Future<void> endImpersonation(String sessionId) async {
    await _dio.delete('/superadmin/impersonate/$sessionId');
  }

  // Emergency
  Future<void> toggleMaintenanceMode(bool enabled,
      {String? message, required String justification}) async {
    await _dio.post('/superadmin/emergency/maintenance-mode',
        data: {
          'enabled': enabled,
          'message': message,
          'justification': justification
        });
  }

  Future<int> forceLogoutAll(String justification) async {
    final r = await _dio.post('/superadmin/emergency/force-logout-all',
        data: {'justification': justification});
    return r.data['affected_count'] ?? 0;
  }

  Future<void> forceLogoutUser(String userId, String justification) async {
    await _dio.post('/superadmin/emergency/force-logout-user/$userId',
        data: {'justification': justification});
  }

  Future<void> lockdownBranch(int branchId, String justification) async {
    await _dio.post('/superadmin/emergency/lockdown-branch/$branchId',
        data: {'justification': justification});
  }

  // Data Overrides
  Future<void> forceApproveRecord(
      String id, String tableName, String justification) async {
    await _dio.post('/superadmin/override/approval/$id/force-approve',
        data: {'table_name': tableName, 'justification': justification});
  }

  Future<void> unlockUserAccount(String userId, String justification) async {
    await _dio.post('/superadmin/override/user/$userId/unlock',
        data: {'justification': justification});
  }

  // Superadmin Audit Log
  Future<List<Map<String, dynamic>>> getSuperadminAuditLog(
      {int limit = 50, String? actionType}) async {
    final r = await _dio.get('/superadmin/audit-log',
        queryParameters: {
          'limit': limit,
          if (actionType != null) 'action_type': actionType
        });
    final data = r.data['data'] ?? r.data;
    return List<Map<String, dynamic>>.from(data is List ? data : []);
  }

  // Backup
  Future<void> triggerBackup(String justification) async {
    await _dio.post('/superadmin/backup/trigger',
        data: {'justification': justification});
  }
}
