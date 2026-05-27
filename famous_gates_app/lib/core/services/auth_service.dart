import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../network/dio_client.dart';
import 'api_service.dart';

final authServiceProvider = Provider<AuthService>((ref) {
  return AuthService(ref.watch(dioProvider));
});

class AuthService extends BaseApiService {
  AuthService(super.dio);

  // POST /api/auth/login
  Future<Map<String, dynamic>> login(String email, String password) async {
    final response = await post<Map<String, dynamic>>(
      '/auth/login',
      data: {'email': email, 'password': password},
    );
    return response;
  }

  // POST /api/auth/pos-login
  Future<Map<String, dynamic>> posLogin(String pin,
      {String? redirectTo}) async {
    final response = await post<Map<String, dynamic>>(
      '/auth/pos-login',
      data: {'pin': pin, if (redirectTo != null) 'redirectTo': redirectTo},
    );
    return response;
  }

  // POST /api/auth/logout
  Future<Map<String, dynamic>> logout() async {
    final response = await post<Map<String, dynamic>>('/auth/logout');
    return response;
  }

  // POST /api/auth/refresh
  Future<Map<String, dynamic>> refreshToken() async {
    final response = await post<Map<String, dynamic>>('/auth/refresh');
    return response;
  }

  // GET /api/auth/me
  Future<Map<String, dynamic>> getCurrentUser() async {
    final response = await get<Map<String, dynamic>>('/auth/me');
    return response;
  }

  // POST /api/auth/forgot-password
  Future<Map<String, dynamic>> forgotPassword(String email) async {
    final response = await post<Map<String, dynamic>>(
      '/auth/forgot-password',
      data: {'email': email},
    );
    return response;
  }

  // POST /api/auth/reset-password
  Future<Map<String, dynamic>> resetPassword(
      String token, String newPassword) async {
    final response = await post<Map<String, dynamic>>(
      '/auth/reset-password',
      data: {'token': token, 'newPassword': newPassword},
    );
    return response;
  }

  // POST /api/auth/change-password
  Future<Map<String, dynamic>> changePassword(
      String currentPassword, String newPassword) async {
    final response = await post<Map<String, dynamic>>(
      '/auth/change-password',
      data: {'currentPassword': currentPassword, 'newPassword': newPassword},
    );
    return response;
  }

  // POST /api/auth/select-context
  Future<Map<String, dynamic>> selectContext(String role, int? branchId) async {
    final response = await post<Map<String, dynamic>>(
      '/auth/select-context',
      data: {'role': role, 'branchId': branchId},
    );
    return response;
  }

  // GET /api/auth/sessions
  Future<List<dynamic>> getActiveSessions() async {
    final response = await get<List<dynamic>>('/auth/sessions');
    return response;
  }

  // DELETE /api/auth/sessions/:id
  Future<Map<String, dynamic>> terminateSession(String sessionId) async {
    final response =
        await delete<Map<String, dynamic>>('/auth/sessions/$sessionId');
    return response;
  }
}
