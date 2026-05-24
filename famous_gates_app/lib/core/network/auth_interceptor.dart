import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class AuthInterceptor extends Interceptor {
  final FlutterSecureStorage _storage = const FlutterSecureStorage();

  @override
  void onRequest(RequestOptions options, RequestInterceptorHandler handler) async {
    final jwt = await _storage.read(key: 'jwt');
    final branchId = await _storage.read(key: 'branch_id');

    if (jwt != null) {
      options.headers['Authorization'] = 'Bearer $jwt';
    }
    if (branchId != null) {
      options.headers['X-Branch-ID'] = branchId;
    }
    
    return handler.next(options);
  }

  @override
  void onError(DioException err, ErrorInterceptorHandler handler) async {
    if (err.response?.statusCode == 401) {
      // Handle unauthorized
      await _storage.delete(key: 'jwt');
      await _storage.delete(key: 'refresh_token');
      // Redirect to login logic would go here or be handled by a listener
    }
    return handler.next(err);
  }
}
