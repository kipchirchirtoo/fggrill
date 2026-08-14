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
    if (!enabled) return;
    if (_initialized) {
      // Already initialized — still resync realtime auth on every call in
      // case the bridge token was reissued (e.g. re-login) since last time.
      await _syncRealtimeAuth();
      return;
    }
    if (_initializing) return;
    _initializing = true;
    try {
      await Supabase.initialize(
        url: AppConfig.supabaseUrl,
        publishableKey: AppConfig.supabaseAnonKey,
        accessToken: () => _ref.read(authRepositoryProvider).getSupabaseToken(),
      );
      _initialized = true;
      await _syncRealtimeAuth();
    } finally {
      _initializing = false;
    }
  }

  /// Explicitly pushes the bridge JWT into the Realtime WebSocket's own
  /// auth state — the `accessToken` callback passed to Supabase.initialize
  /// above only feeds Postgrest/Storage/Functions REST calls, it is never
  /// wired into Realtime automatically.
  ///
  /// Traced through the SDK: `RealtimeClient.accessToken` (the string
  /// field actually sent with each channel join, distinct from the
  /// `customAccessToken` callback) is set exactly once at construction —
  /// from the anon key, since no bearer header exists yet at that point
  /// (realtime_client.dart's constructor: `accessToken = customJWT ??
  /// params['apikey']`). The only thing that ever calls `realtime.setAuth`
  /// afterwards is `SupabaseClient`'s own listener on GoTrue's
  /// `onAuthStateChange` stream (supabase_client.dart) — which never fires
  /// here, because this app's login is bcrypt + a custom JWT, not a
  /// Supabase Auth sign-in (see this class's doc comment). Net effect
  /// without this: the Realtime socket stays on the anon key forever,
  /// `auth.uid()` evaluates NULL for every postgres_changes event, and any
  /// RLS policy gated on `user_id = auth.uid()` matches nothing — silently
  /// dropping every live event no matter how correct the policy or the
  /// client-side subscription code is.
  Future<void> _syncRealtimeAuth() async {
    final token = await _ref.read(authRepositoryProvider).getSupabaseToken();
    if (token == null || token.isEmpty) return;
    await Supabase.instance.client.realtime.setAuth(token);
  }

  /// Null when direct-Supabase is disabled, not yet initialized, or the
  /// current session has no bridge token (e.g. backend hasn't issued one
  /// yet) — callers must fall back to the existing Render/Dio path rather
  /// than treat this as a retryable error.
  SupabaseClient? get client => (enabled && _initialized) ? Supabase.instance.client : null;
}
