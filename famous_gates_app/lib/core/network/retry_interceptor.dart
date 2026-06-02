import 'dart:io';

import 'package:dio/dio.dart';

import '../utils/working_directory_guard.dart';

class RetryInterceptor extends Interceptor {
  final Dio dio;
  final int maxRetries;
  final int initialDelayMs;

  RetryInterceptor(this.dio, {this.maxRetries = 3, this.initialDelayMs = 1000});

  @override
  void onError(DioException err, ErrorInterceptorHandler handler) async {
    ensureStableWorkingDirectory();
    var requestOptions = err.requestOptions;
    int attempt = requestOptions.extra['retry_attempt'] ?? 0;

    if (_shouldRetry(err) && attempt < maxRetries) {
      attempt++;
      requestOptions.extra['retry_attempt'] = attempt;

      final delay = initialDelayMs * attempt; // Simple backoff
      await Future.delayed(Duration(milliseconds: delay));

      try {
        ensureStableWorkingDirectory();
        final response = await dio.fetch(requestOptions);
        return handler.resolve(response);
      } on DioException catch (e) {
        return handler.next(e);
      }
    }
    return handler.next(err);
  }

  bool _shouldRetry(DioException err) {
    return err.type == DioExceptionType.connectionTimeout ||
        err.type == DioExceptionType.receiveTimeout ||
        err.type == DioExceptionType.sendTimeout ||
        _isWorkingDirectoryError(err.error) ||
        (err.response?.statusCode != null && err.response!.statusCode! >= 500);
  }

  bool _isWorkingDirectoryError(Object? error) {
    if (error is PathNotFoundException) {
      return '${error.message} ${error.path}'
          .toLowerCase()
          .contains('current working directory');
    }
    if (error is FileSystemException) {
      return '${error.message} ${error.path}'
          .toLowerCase()
          .contains('current working directory');
    }
    return '$error'.toLowerCase().contains('current working directory');
  }
}
