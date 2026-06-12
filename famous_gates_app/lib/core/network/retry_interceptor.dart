import 'dart:io';
import 'dart:convert';

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

    if (_shouldRetry(err) &&
        _canRetry(requestOptions) &&
        attempt < maxRetries) {
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

  bool _canRetry(RequestOptions options) {
    if (options.extra['disable_retry'] == true) return false;
    final method = options.method.toUpperCase();
    return method == 'GET' || method == 'HEAD' || method == 'OPTIONS';
  }

  bool _shouldRetry(DioException err) {
    if (_isDeterministicServerError(err)) return false;
    if (err.response?.statusCode == 429) return false;
    return err.type == DioExceptionType.connectionTimeout ||
        err.type == DioExceptionType.receiveTimeout ||
        err.type == DioExceptionType.sendTimeout ||
        _isWorkingDirectoryError(err.error) ||
        (err.response?.statusCode != null && err.response!.statusCode! >= 500);
  }

  bool _isDeterministicServerError(DioException err) {
    if (err.response?.statusCode != 500) return false;
    final message = _responseMessage(err.response?.data);
    return message.contains('Could not find a relationship') ||
        message.contains('schema cache') ||
        message.contains('Request failed with status code 429');
  }

  String _responseMessage(Object? data) {
    if (data is Map) return '${data['message'] ?? data['error'] ?? ''}';
    if (data is List<int>) {
      try {
        final decoded = jsonDecode(utf8.decode(data));
        if (decoded is Map) {
          return '${decoded['message'] ?? decoded['error'] ?? decoded}';
        }
        return '$decoded';
      } catch (_) {
        return '$data';
      }
    }
    return '$data';
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
