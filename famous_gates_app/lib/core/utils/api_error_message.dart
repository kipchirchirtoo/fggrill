import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';

String apiErrorMessage(Object error, {String fallback = 'Request failed'}) {
  if (error is DioException) {
    final statusCode = error.response?.statusCode;
    final data = error.response?.data;
    final serverMessage = _messageFromResponseData(data);
    if (serverMessage != null && serverMessage.isNotEmpty) {
      if (_isRawDioExceptionMessage(serverMessage)) {
        return _statusMessage(statusCode, fallback);
      }
      if (_isServiceSuspendedMessage(serverMessage)) {
        return 'The Famous Gates server is currently suspended or unavailable. Restore the backend service, then try again.';
      }
      return serverMessage;
    }
    if (statusCode == 401) {
      return 'Your session has expired. Sign in again.';
    }
    if (statusCode == 403) {
      return 'You do not have permission to perform this action.';
    }
    if (statusCode == 404) {
      return 'The requested record or route was not found.';
    }
    if (statusCode != null && statusCode >= 500) {
      if (statusCode == 503) {
        return 'The Famous Gates server is currently unavailable. Try again after the backend service is restored.';
      }
      return 'The server could not complete the request. Try again.';
    }
    return error.message ?? fallback;
  }
  final text = error.toString();
  if (_isRawDioExceptionMessage(text)) {
    final statusCode = _statusCodeFromRawText(text);
    return _statusMessage(statusCode, fallback);
  }
  if (text.startsWith('Exception: ')) {
    final message = text.substring(11);
    if (_isRawDioExceptionMessage(message)) {
      final statusCode = _statusCodeFromRawText(message);
      return _statusMessage(statusCode, fallback);
    }
    return message;
  }
  return text.isEmpty ? fallback : text;
}

bool _isServiceSuspendedMessage(String value) {
  final normalized = value.toLowerCase();
  return normalized.contains('service suspended') ||
      normalized.contains('this service has been suspended');
}

bool _isRawDioExceptionMessage(String value) {
  final normalized = value.toLowerCase();
  return normalized.contains('dioexception') ||
      normalized.contains('requestoptions.validatestatus') ||
      normalized.contains('read more about status codes') ||
      normalized.contains('developer.mozilla.org/en-us/docs/web/http/status');
}

int? _statusCodeFromRawText(String value) {
  final match = RegExp(r'status code of (\d{3})|status code (\d{3})')
      .firstMatch(value.toLowerCase());
  if (match == null) return null;
  return int.tryParse(match.group(1) ?? match.group(2) ?? '');
}

String _statusMessage(int? statusCode, String fallback) {
  if (statusCode == 401) {
    return 'Your session has expired. Sign in again.';
  }
  if (statusCode == 403) {
    return 'You do not have permission to perform this action.';
  }
  if (statusCode == 404) {
    return 'The requested record or route was not found.';
  }
  if (statusCode == 400) {
    return 'The request could not be completed. Check the entered details and try again.';
  }
  if (statusCode == 503) {
    return 'The Famous Gates server is currently unavailable. Try again after the backend service is restored.';
  }
  if (statusCode != null && statusCode >= 500) {
    return 'The server could not complete the request. Try again.';
  }
  return fallback;
}

String? _messageFromResponseData(dynamic data) {
  if (data == null) {
    return null;
  }
  if (data is Map) {
    for (final key in const ['message', 'error', 'detail']) {
      final value = data[key];
      if (value != null && value.toString().trim().isNotEmpty) {
        return value.toString();
      }
    }
  }
  if (data is List<int>) {
    return _messageFromBytes(Uint8List.fromList(data));
  }
  if (data is Uint8List) {
    return _messageFromBytes(data);
  }
  if (data is String && data.trim().isNotEmpty) {
    final decoded = _tryDecodeJson(data);
    return decoded == null ? data : _messageFromResponseData(decoded);
  }
  return null;
}

String? _messageFromBytes(Uint8List bytes) {
  if (bytes.isEmpty) {
    return null;
  }
  final decoded = utf8.decode(bytes, allowMalformed: true);
  final json = _tryDecodeJson(decoded);
  return json == null ? decoded : _messageFromResponseData(json);
}

dynamic _tryDecodeJson(String value) {
  try {
    return jsonDecode(value);
  } catch (_) {
    return null;
  }
}
