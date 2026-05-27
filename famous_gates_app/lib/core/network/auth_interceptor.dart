import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../storage/secure_storage_provider.dart';
import '../../features/auth/data/auth_repository.dart';

class AuthInterceptor extends Interceptor {
  AuthInterceptor(this._ref);

  final Ref _ref;

  @override
  void onRequest(
      RequestOptions options, RequestInterceptorHandler handler) async {
    final storage = _ref.read(secureStorageProvider);
    final jwt = await storage.read(key: AuthRepository.jwtKey);
    final branchId = await storage.read(key: AuthRepository.branchIdKey);

    if (jwt != null) {
      options.headers['Authorization'] = 'Bearer $jwt';
    }
    final normalizedBranchId = branchId?.trim() ?? '';
    final normalizedBranchIdLower = normalizedBranchId.toLowerCase();
    if (normalizedBranchId.isNotEmpty &&
        normalizedBranchIdLower != 'null' &&
        normalizedBranchIdLower != 'nan') {
      options.headers['X-Branch-ID'] = normalizedBranchId;
    }

    return handler.next(options);
  }

  @override
  void onError(DioException err, ErrorInterceptorHandler handler) async {
    if (err.response?.statusCode == 401) {
      final storage = _ref.read(secureStorageProvider);
      await storage.delete(key: AuthRepository.jwtKey);
      await storage.delete(key: AuthRepository.refreshKey);
    }
    return handler.next(err);
  }
}
