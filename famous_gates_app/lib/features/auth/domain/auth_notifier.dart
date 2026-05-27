import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../data/auth_repository.dart';
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

  Future<LicenseInfo> validateLicense(String licenseKey, String branchCode) {
    return ref
        .read(authRepositoryProvider)
        .validateLicense(licenseKey, branchCode);
  }
}
