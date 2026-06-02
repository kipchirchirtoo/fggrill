import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../config/app_config.dart';
import '../utils/working_directory_guard.dart';
import 'auth_interceptor.dart';
import 'retry_interceptor.dart';
import 'cert_handling_stub.dart' if (dart.library.io) 'cert_handling_io.dart';

class _WorkingDirectoryInterceptor extends Interceptor {
  @override
  void onRequest(RequestOptions options, RequestInterceptorHandler handler) {
    ensureStableWorkingDirectory();
    handler.next(options);
  }
}

final dioProvider = Provider<Dio>((ref) {
  final dio = Dio(
    BaseOptions(
      baseUrl: AppConfig.mainApiUrl,
      connectTimeout: const Duration(seconds: 30),
      receiveTimeout: const Duration(seconds: 30),
      headers: const {'Content-Type': 'application/json'},
    ),
  );

  applyCertHandling(dio);

  dio.interceptors.addAll([
    _WorkingDirectoryInterceptor(),
    AuthInterceptor(ref),
    RetryInterceptor(dio),
    if (kDebugMode)
      LogInterceptor(
        requestHeader: false,
        responseHeader: false,
        requestBody: true,
        responseBody: true,
      ),
  ]);

  return dio;
});

final pythonDioProvider = Provider<Dio>((ref) {
  final dio = Dio(
    BaseOptions(
      baseUrl: AppConfig.pythonServicesBaseUrl,
      connectTimeout: const Duration(seconds: 15),
      receiveTimeout: const Duration(seconds: 30),
      headers: const {'Content-Type': 'application/json'},
    ),
  );

  applyCertHandling(dio);

  dio.interceptors.addAll([
    _WorkingDirectoryInterceptor(),
    AuthInterceptor(ref),
    RetryInterceptor(dio),
    if (kDebugMode)
      LogInterceptor(
        requestHeader: false,
        responseHeader: false,
        requestBody: true,
        responseBody: true,
      ),
  ]);

  return dio;
});
