import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../config/app_config.dart';
import '../../features/auth/data/auth_repository.dart';

final supabaseDirectServiceProvider = Provider<SupabaseDirectService>(
  (ref) => SupabaseDirectService(ref),
);

/// Direct-to-Supabase reads for data that doesn't need Node's business logic
/// (menu, kitchen/order status, stock levels) — secured by RLS instead of
/// the backend's application-layer branch checks. Writes that need
/// atomicity, secrets, or side effects (order creation, payments, printing)
/// stay on the Render backend; this service is read/Realtime-only.
///
/// Auth here deliberately bypasses Supabase's own GoTrue session/sign-in —
/// this app's login is bcrypt + a custom JWT (auth.controller.ts), not
/// Supabase Auth. Login mints a second, Supabase-JWT-secret-signed token
/// ("supabase_token", stored via AuthRepository) purely so RLS's
/// `auth.uid()` resolves; the `accessToken` callback below hands that token
/// to the Supabase client on every request, which is the officially
/// supported "third-party auth" integration point for this exact case (see
/// the `accessToken` param on `SupabaseClient`/`Supabase.initialize`).
class SupabaseDirectService {
  SupabaseDirectService(this._ref);

  final Ref _ref;
  bool _initializing = false;
  bool _initialized = false;

  bool get enabled =>
      AppConfig.directSupabaseEnabled &&
      AppConfig.supabaseUrl.isNotEmpty &&
      AppConfig.supabaseAnonKey.isNotEmpty;

  Future<void> ensureReady() async {
    if (!enabled || _initialized) return;
    if (_initializing) return;
    _initializing = true;
    try {
      await Supabase.initialize(
        url: AppConfig.supabaseUrl,
        publishableKey: AppConfig.supabaseAnonKey,
        accessToken: () => _ref.read(authRepositoryProvider).getSupabaseToken(),
      );
      _initialized = true;
    } finally {
      _initializing = false;
    }
  }

  /// Null when direct-Supabase is disabled, not yet initialized, or the
  /// current session has no bridge token (e.g. backend hasn't issued one
  /// yet) — callers must fall back to the existing Render/Dio path rather
  /// than treat this as a retryable error.
  SupabaseClient? get client => (enabled && _initialized) ? Supabase.instance.client : null;
}
