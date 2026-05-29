import 'package:dio/dio.dart';
import '../../../core/utils/api_error_message.dart';

class SuperadminGodException implements Exception {
  final String message;
  const SuperadminGodException(this.message);

  @override
  String toString() => message;
}

class SuperadminGodRepository {
  final Dio _dio;
  SuperadminGodRepository(this._dio);

  String _friendlyError(DioException error) {
    final data = error.response?.data;
    final status = error.response?.statusCode;
    final genericMessage = apiErrorMessage(
      error,
      fallback: 'The SuperAdmin API request failed. Try again.',
    );
    String? serverMessage;

    if (data is Map) {
      serverMessage = (data['message'] ?? data['error'] ?? data['details'])
          ?.toString()
          .trim();
    } else if (data is String && data.trim().isNotEmpty) {
      serverMessage = data.trim();
    }

    if (status == 401) {
      return 'Your session has expired. Log in again to continue.';
    }
    if (status == 403) {
      return 'You do not have permission to perform this SuperAdmin action.';
    }
    if (status == 404) {
      return serverMessage ?? 'The requested SuperAdmin record was not found.';
    }
    if (serverMessage != null && serverMessage.isNotEmpty) {
      if (_isRawDioMessage(serverMessage)) {
        return genericMessage;
      }
      if (serverMessage.contains('Could not find a relationship') ||
          serverMessage.contains('schema cache')) {
        return 'The database schema is missing a required relationship. Run the latest migrations and retry.';
      }
      if (serverMessage.contains('column') &&
          serverMessage.contains('does not exist')) {
        return 'The database schema is missing a required column. Run the latest migrations and retry.';
      }
      return serverMessage;
    }
    if (status != null && status >= 500) {
      return genericMessage;
    }
    return genericMessage;
  }

  bool _isRawDioMessage(String value) {
    final normalized = value.toLowerCase();
    return normalized.contains('dioexception') ||
        normalized.contains('requestoptions.validatestatus') ||
        normalized.contains('developer.mozilla.org/en-us/docs/web/http/status');
  }

  Future<T> _guard<T>(Future<T> Function() action) async {
    try {
      return await action();
    } on DioException catch (error) {
      throw SuperadminGodException(_friendlyError(error));
    }
  }

  // Feature Flags
  Future<List<Map<String, dynamic>>> getFeatureFlags() async {
    return _guard(() async {
      final r = await _dio.get('/superadmin/feature-flags');
      final data = r.data['data'] ?? r.data;
      return List<Map<String, dynamic>>.from(data is List ? data : []);
    });
  }

  Future<void> createFeatureFlag(Map<String, dynamic> body) async {
    await _guard(
        () async => _dio.post('/superadmin/feature-flags', data: body));
  }

  Future<void> updateFeatureFlag(int id, Map<String, dynamic> body) async {
    await _guard(
        () async => _dio.put('/superadmin/feature-flags/$id', data: body));
  }

  Future<void> deleteFeatureFlag(int id) async {
    await _guard(() async => _dio.delete('/superadmin/feature-flags/$id'));
  }

  // Announcements
  Future<List<Map<String, dynamic>>> getAnnouncements() async {
    return _guard(() async {
      final r = await _dio.get('/superadmin/announcements');
      final data = r.data['data'] ?? r.data;
      return List<Map<String, dynamic>>.from(data is List ? data : []);
    });
  }

  Future<void> createAnnouncement(Map<String, dynamic> body) async {
    await _guard(
        () async => _dio.post('/superadmin/announcements', data: body));
  }

  Future<void> deleteAnnouncement(String id) async {
    await _guard(() async => _dio.delete('/superadmin/announcements/$id'));
  }

  // Security Config
  Future<Map<String, dynamic>> getSecurityConfig() async {
    return _guard(() async {
      final r = await _dio.get('/superadmin/config/security');
      return Map<String, dynamic>.from(r.data['data'] ?? r.data);
    });
  }

  Future<void> updateSecurityConfig(Map<String, dynamic> body) async {
    await _guard(
        () async => _dio.put('/superadmin/config/security', data: body));
  }

  // Impersonation
  Future<Map<String, dynamic>> startImpersonation(
      String userId, String justification) async {
    return _guard(() async {
      final r = await _dio.post('/superadmin/impersonate/$userId',
          data: {'justification': justification});
      return Map<String, dynamic>.from(r.data);
    });
  }

  Future<void> endImpersonation(String sessionId) async {
    await _guard(() async => _dio.delete('/superadmin/impersonate/$sessionId'));
  }

  // Emergency
  Future<void> toggleMaintenanceMode(bool enabled,
      {String? message, required String justification}) async {
    await _guard(() async => _dio.post('/superadmin/emergency/maintenance-mode',
            data: {
              'enabled': enabled,
              'message': message,
              'justification': justification
            }));
  }

  Future<int> forceLogoutAll(String justification) async {
    return _guard(() async {
      final r = await _dio.post('/superadmin/emergency/force-logout-all',
          data: {'justification': justification});
      return r.data['affected_count'] ?? 0;
    });
  }

  Future<void> forceLogoutUser(String userId, String justification) async {
    await _guard(() async => _dio.post(
        '/superadmin/emergency/force-logout-user/$userId',
        data: {'justification': justification}));
  }

  Future<void> lockdownBranch(int branchId, String justification) async {
    await _guard(() async => _dio.post(
        '/superadmin/emergency/lockdown-branch/$branchId',
        data: {'justification': justification}));
  }

  // Data Overrides
  Future<void> forceApproveRecord(
      String id, String tableName, String justification) async {
    await _guard(() async => _dio.post(
        '/superadmin/override/approval/$id/force-approve',
        data: {'table_name': tableName, 'justification': justification}));
  }

  Future<void> unlockUserAccount(String userId, String justification) async {
    await _guard(() async => _dio.post(
        '/superadmin/override/user/$userId/unlock',
        data: {'justification': justification}));
  }

  // Superadmin Audit Log
  Future<List<Map<String, dynamic>>> getSuperadminAuditLog(
      {int limit = 50, String? actionType}) async {
    return _guard(() async {
      final r = await _dio.get('/superadmin/audit-log', queryParameters: {
        'limit': limit,
        if (actionType != null) 'action_type': actionType
      });
      final data = r.data['data'] ?? r.data;
      return List<Map<String, dynamic>>.from(data is List ? data : []);
    });
  }

  // Backup
  Future<void> triggerBackup(String justification) async {
    await _guard(() async => _dio.post('/superadmin/backup/trigger',
        data: {'justification': justification}));
  }
}
