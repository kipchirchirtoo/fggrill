import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../storage/secure_storage_provider.dart';
import '../utils/working_directory_guard.dart';
import '../../features/auth/data/auth_repository.dart';
import '../../features/auth/domain/auth_notifier.dart';

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

    // POS terminal (device/branch) context, when this machine is registered.
    // Read side-effect-free here — the device-token handshake runs elsewhere;
    // the interceptor only forwards a cached token so the server can bind the
    // request to the terminal's branch. Key kept in sync with
    // PosTerminalService (pos_terminal_device_token).
    final deviceToken = await storage.read(key: 'pos_terminal_device_token');
    final normalizedDeviceToken = deviceToken?.trim() ?? '';
    if (normalizedDeviceToken.isNotEmpty &&
        normalizedDeviceToken.toLowerCase() != 'null') {
      options.headers['X-POS-Terminal-Token'] = normalizedDeviceToken;
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
      // Force re-login when the token was explicitly rejected OR when no
      // token was sent at all. The second case covers the race where a
      // previous 401 already deleted the token but a concurrent poller
      // (e.g. the KDS 2-second refresh) fires another request before the
      // forceSessionExpired redirect lands — without this branch every
      // subsequent unauthenticated request loops as 401 forever.
      if ((hadToken && tokenRejected) || !hadToken) {
        final storage = _ref.read(secureStorageProvider);
        await storage.delete(key: AuthRepository.jwtKey);
        await storage.delete(key: AuthRepository.refreshKey);
        _ref.read(authNotifierProvider.notifier).forceSessionExpired();
      }
    }
    return handler.next(err);
  }

  String _responseMessage(Object? data) {
    if (data is Map) return '${data['message'] ?? data['error'] ?? ''}';
    return '$data';
  }
}
