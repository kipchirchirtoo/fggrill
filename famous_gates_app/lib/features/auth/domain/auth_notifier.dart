import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../data/auth_repository.dart';
import '../../pos_terminal/data/pos_terminal_service.dart';
import 'models.dart';

final authNotifierProvider =
    AsyncNotifierProvider<AuthNotifier, User?>(AuthNotifier.new);

final hasStoredLicenseProvider = FutureProvider<bool>((ref) {
  return ref.read(authRepositoryProvider).hasStoredLicense();
});

class AuthNotifier extends AsyncNotifier<User?> {
  @override
  Future<User?> build() {
    return ref.read(authRepositoryProvider).getCurrentUser();
  }

  Future<User> login(String email, String password,
      {bool rememberMe = false}) async {
    state = const AsyncValue.loading();
    final result = await AsyncValue.guard(() {
      return ref
          .read(authRepositoryProvider)
          .login(email, password, rememberMe: rememberMe);
    });
    state = result;
    return result.requireValue;
  }

  Future<String?> getRememberedEmail() {
    return ref.read(authRepositoryProvider).getRememberedEmail();
  }

  Future<User> posLogin(String pin) async {
    state = const AsyncValue.loading();
    // Ensure this terminal's device token is fresh and cached BEFORE the login
    // request, so the request carries the terminal's branch context and the
    // backend scopes the PIN to this terminal's branch — a registered Kyogong
    // terminal must reject another branch's PIN. Best-effort: a token failure
    // must not block login on an unregistered / grandfathered terminal.
    try {
      final token = await ref.read(posTerminalServiceProvider).ensureDeviceToken();
      debugPrint('[PosTerminal] posLogin: device token ${token != null ? "ready → branch context sent" : "null (grandfather / unregistered)"}');
    } catch (e) {
      debugPrint('[PosTerminal] posLogin: ensureDeviceToken error — $e');
    }
    final result = await AsyncValue.guard(() {
      return ref.read(authRepositoryProvider).posLogin(pin);
    });
    state = result;
    return result.requireValue;
  }

  Future<void> logout() async {
    await ref.read(authRepositoryProvider).logout();
    state = const AsyncValue.data(null);
  }

  Future<List<UserContextAssignment>> fetchAvailableContexts(String userId) {
    return ref.read(authRepositoryProvider).fetchAvailableContexts(userId);
  }

  Future<User> switchContext(UserContextAssignment context) async {
    state = const AsyncValue.loading();
    final result = await AsyncValue.guard(() {
      return ref.read(authRepositoryProvider).switchContext(context);
    });
    state = result;
    return result.requireValue;
  }

  /// Called when the network layer discovers the stored token was rejected
  /// (expired/invalid/force-logout) by the backend. The token itself is
  /// already cleared by the caller — this just syncs auth state so the
  /// router redirects to /login instead of leaving the user stranded on a
  /// dashboard that silently 401s on every request.
  void forceSessionExpired() {
    state = const AsyncValue.data(null);
  }

  Future<LicenseInfo> validateLicense(String licenseKey, String branchCode) {
    return ref
        .read(authRepositoryProvider)
        .validateLicense(licenseKey, branchCode);
  }
}
