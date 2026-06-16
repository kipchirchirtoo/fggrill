import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../storage/secure_storage_provider.dart';
import '../utils/working_directory_guard.dart';
import '../../features/auth/data/auth_repository.dart';

class AuthInterceptor extends Interceptor {
  AuthInterceptor(this._ref);

  final Ref _ref;

  @override
  void onRequest(
      RequestOptions options, RequestInterceptorHandler handler) async {
    ensureStableWorkingDirectory();
    final storage = _ref.read(secureStorageProvider);
    final jwt = await storage.read(key: AuthRepository.jwtKey);
    final branchId = await storage.read(key: AuthRepository.branchIdKey);

    final normalizedJwt = jwt?.trim() ?? '';
    if (normalizedJwt.isNotEmpty && normalizedJwt.toLowerCase() != 'null') {
      options.headers['Authorization'] = 'Bearer $normalizedJwt';
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
    ensureStableWorkingDirectory();
    if (err.response?.statusCode == 401) {
      final message = _responseMessage(err.response?.data).toLowerCase();
      final hadToken =
          '${err.requestOptions.headers['Authorization'] ?? ''}'.isNotEmpty;
      final tokenRejected = message.contains('invalid') ||
          message.contains('expired') ||
          message.contains('force logout') ||
          message.contains('token no longer valid');
      if (hadToken && tokenRejected) {
        final storage = _ref.read(secureStorageProvider);
        await storage.delete(key: AuthRepository.jwtKey);
        await storage.delete(key: AuthRepository.refreshKey);
      }
    }
    return handler.next(err);
  }

  String _responseMessage(Object? data) {
    if (data is Map) return '${data['message'] ?? data['error'] ?? ''}';
    return '$data';
  }
}
