import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';

String apiErrorMessage(Object error, {String fallback = 'Request failed'}) {
  if (error is DioException) {
    final statusCode = error.response?.statusCode;
    final data = error.response?.data;
    final serverMessage = _messageFromResponseData(data);
    if (serverMessage != null && serverMessage.isNotEmpty) {
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
      return 'The server could not complete the request. Try again.';
    }
    return error.message ?? fallback;
  }
  final text = error.toString();
  if (text.startsWith('Exception: ')) {
    return text.substring(11);
  }
  return text.isEmpty ? fallback : text;
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
