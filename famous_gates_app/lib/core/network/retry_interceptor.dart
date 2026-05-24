import 'package:dio/dio.dart';

class RetryInterceptor extends Interceptor {
  final int maxRetries;
  final int initialDelayMs;

  RetryInterceptor({this.maxRetries = 3, this.initialDelayMs = 1000});

  @override
  void onError(DioException err, ErrorInterceptorHandler handler) async {
    var requestOptions = err.requestOptions;
    int attempt = requestOptions.extra['retry_attempt'] ?? 0;

    if (_shouldRetry(err) && attempt < maxRetries) {
      attempt++;
      requestOptions.extra['retry_attempt'] = attempt;
      
      final delay = initialDelayMs * attempt; // Simple backoff
      await Future.delayed(Duration(milliseconds: delay));

      try {
        final response = await Dio().fetch(requestOptions);
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
        (err.response?.statusCode != null && err.response!.statusCode! >= 500);
  }
}
