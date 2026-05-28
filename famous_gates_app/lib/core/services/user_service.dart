import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../network/dio_client.dart';
import 'api_service.dart';

final userServiceProvider = Provider<UserService>((ref) {
  return UserService(ref.watch(dioProvider));
});

class UserService extends BaseApiService {
  UserService(super.dio);

  // GET /api/users
  Future<Map<String, dynamic>> getUsers({
    String? search,
    String? role,
    int? branchId,
    String? status,
    int page = 1,
    int limit = 50,
  }) async {
    final query = {
      if (search != null) 'search': search,
      if (role != null) 'role': role,
      if (branchId != null) 'branchId': branchId,
      if (status != null) 'status': status,
      'page': page,
      'limit': limit,
    };
    final response =
        await get<Map<String, dynamic>>('/users', queryParameters: query);
    return response;
  }

  // GET /api/users/:id
  Future<Map<String, dynamic>> getUser(String id) async {
    final response = await get<Map<String, dynamic>>('/users/$id');
    return response;
  }

  // POST /api/users
  Future<Map<String, dynamic>> createUser(Map<String, dynamic> userData) async {
    final response = await post<Map<String, dynamic>>('/users', data: userData);
    return response;
  }

  // PUT /api/users/:id
  Future<Map<String, dynamic>> updateUser(
      String id, Map<String, dynamic> userData) async {
    final response =
        await put<Map<String, dynamic>>('/users/$id', data: userData);
    return response;
  }

  // PATCH /api/users/:id/status
  Future<Map<String, dynamic>> updateUserStatus(
      String id, String status) async {
    final response = await patch<Map<String, dynamic>>('/users/$id/status',
        data: {'status': status});
    return response;
  }

  // DELETE /api/users/:id
  Future<Map<String, dynamic>> deleteUser(String id) async {
    final response = await delete<Map<String, dynamic>>('/users/$id');
    return response;
  }

  // PUT /api/users/:id with a password payload. The backend updates both
  // public.users.password_hash and Supabase Auth from the standard user update route.
  Future<Map<String, dynamic>> resetUserPassword(
    String id,
    String newPassword,
  ) async {
    final response = await put<Map<String, dynamic>>(
      '/users/$id',
      data: {'password': newPassword},
    );
    return response;
  }

  // POST /api/users/:id/force-logout
  Future<Map<String, dynamic>> forceLogout(String id) async {
    final response =
        await post<Map<String, dynamic>>('/users/$id/force-logout');
    return response;
  }

  // GET /api/users/:id/roles
  Future<List<dynamic>> getUserRoles(String id) async {
    final response = await get<List<dynamic>>('/users/$id/roles');
    return response;
  }

  // POST /api/users/:id/roles
  Future<Map<String, dynamic>> assignRole(
      String id, String role, int? branchId) async {
    final response = await post<Map<String, dynamic>>(
      '/users/$id/roles',
      data: {'role': role, 'branchId': branchId},
    );
    return response;
  }

  // DELETE /api/users/:id/roles/:roleId
  Future<Map<String, dynamic>> removeRole(String id, String roleId) async {
    final response =
        await delete<Map<String, dynamic>>('/users/$id/roles/$roleId');
    return response;
  }

  // GET /api/users/stats
  Future<Map<String, dynamic>> getUserStats() async {
    final response = await get<Map<String, dynamic>>('/users/stats');
    return response;
  }

  // POST /api/users/:id/photo
  Future<Map<String, dynamic>> uploadProfilePhoto(
      String id, String filePath) async {
    final formData = FormData.fromMap({
      'photo': await MultipartFile.fromFile(filePath),
    });
    final response = await dio.post('/users/$id/photo', data: formData);
    return response.data;
  }
}
