import 'dart:async';

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
      // 60 s receive timeout: the POS login endpoint makes several parallel
      // Supabase calls that can take a combined 10–20 s on slow networks.
      // 30 s was too tight and caused spurious receive-timeout exceptions.
      receiveTimeout: const Duration(seconds: 60),
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
        requestBody: false,
        responseBody: false,
      ),
  ]);

  return dio;
});

final pythonDioProvider = Provider<Dio>((ref) {
  final dio = Dio(
    BaseOptions(
      baseUrl: AppConfig.pythonServicesBaseUrl,
      connectTimeout: const Duration(seconds: 30),
      receiveTimeout: const Duration(minutes: 2),
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
        requestBody: false,
        responseBody: false,
      ),
  ]);

  Future<void> keepAlive() async {
    // Use a dedicated lightweight Dio for health pings:
    //   - Short connectTimeout (5 s) so we fail fast instead of the 30 s
    //     global default. Dio's Options can't override connectTimeout
    //     per-request, so a separate instance is the only way.
    //   - No interceptors → no LogInterceptor noise in debug output.
    final pinger = Dio(
      BaseOptions(
        baseUrl: AppConfig.pythonServicesBaseUrl,
        connectTimeout: const Duration(seconds: 5),
        receiveTimeout: const Duration(seconds: 5),
        sendTimeout: const Duration(seconds: 5),
      ),
    );
    try {
      await pinger.get('/health');
    } catch (_) {
      // Best-effort warm ping only. User-facing requests still surface errors.
    } finally {
      pinger.close(force: true);
    }
  }

  unawaited(keepAlive());
  final timer = Timer.periodic(const Duration(minutes: 4), (_) {
    unawaited(keepAlive());
  });
  ref.onDispose(timer.cancel);

  return dio;
});
