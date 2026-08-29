import 'dart:convert';

import 'package:cryptography/cryptography.dart';
import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:uuid/uuid.dart';

import '../../../core/network/dio_client.dart';
import '../../../core/storage/secure_storage_provider.dart';

/// Local identity of a registered POS terminal. The branch here is only for
/// display — the server is always the authority (it re-derives the branch from
/// the authenticated device on every request).
class PosTerminalIdentity {
  const PosTerminalIdentity({
    required this.terminalId,
    required this.terminalCode,
    required this.terminalName,
    required this.terminalType,
    required this.branchId,
    required this.status,
  });

  final String terminalId;
  final String terminalCode;
  final String terminalName;
  final String terminalType;
  final int branchId;
  final String status;

  Map<String, dynamic> toJson() => {
        'terminal_id': terminalId,
        'terminal_code': terminalCode,
        'terminal_name': terminalName,
        'terminal_type': terminalType,
        'branch_id': branchId,
        'status': status,
      };

  static PosTerminalIdentity fromJson(Map<String, dynamic> j) => PosTerminalIdentity(
        terminalId: '${j['terminal_id'] ?? ''}',
        terminalCode: '${j['terminal_code'] ?? ''}',
        terminalName: '${j['terminal_name'] ?? ''}',
        terminalType: '${j['terminal_type'] ?? ''}',
        branchId: int.tryParse('${j['branch_id'] ?? 0}') ?? 0,
        status: '${j['status'] ?? ''}',
      );
}

class PosTerminalService {
  PosTerminalService(this._dio, this._storage);

  final Dio _dio;
  final FlutterSecureStorage _storage;
  static final _ed25519 = Ed25519();
  static const _uuid = Uuid();

  // Secure-storage keys.
  static const _kIdentity = 'pos_terminal_identity';
  static const _kSeed = 'pos_terminal_seed'; // base64 Ed25519 32-byte seed
  static const _kFingerprint = 'pos_terminal_fingerprint';
  static const _kDeviceToken = 'pos_terminal_device_token';
  static const _kDeviceTokenExp = 'pos_terminal_device_token_exp';

  /// Header the API expects for terminal (branch) context.
  static const deviceTokenHeader = 'X-POS-Terminal-Token';

  Future<PosTerminalIdentity?> loadIdentity() async {
    final raw = await _storage.read(key: _kIdentity);
    if (raw == null || raw.trim().isEmpty) return null;
    try {
      return PosTerminalIdentity.fromJson(jsonDecode(raw) as Map<String, dynamic>);
    } catch (_) {
      return null;
    }
  }

  Future<bool> get isRegistered async => (await loadIdentity()) != null;

  /// Stable per-install fingerprint (generated once, then reused).
  Future<String> _fingerprint() async {
    final existing = await _storage.read(key: _kFingerprint);
    if (existing != null && existing.trim().isNotEmpty) return existing;
    final fp = _uuid.v4();
    await _storage.write(key: _kFingerprint, value: fp);
    return fp;
  }

  /// Step 1 — validate an enrollment code and return what it binds to. Does not
  /// consume the code.
  Future<Map<String, dynamic>> verifyCode(String code) async {
    final res = await _dio.post('/pos-terminals/enroll/verify', data: {'code': code.trim()});
    return Map<String, dynamic>.from((res.data as Map)['data'] as Map);
  }

  /// Step 2 — generate the device keypair, consume the code, and bind this
  /// device to the terminal. The private seed never leaves secure storage.
  Future<PosTerminalIdentity> register({
    required String code,
    String? appVersion,
    String? osVersion,
  }) async {
    final keyPair = await _ed25519.newKeyPair();
    final seed = await keyPair.extractPrivateKeyBytes(); // 32-byte Ed25519 seed
    final publicKey = await keyPair.extractPublicKey(); // SimplePublicKey, 32 bytes
    final fingerprint = await _fingerprint();

    final res = await _dio.post('/pos-terminals/enroll/register', data: {
      'code': code.trim(),
      'device_public_key': base64Encode(publicKey.bytes),
      'device_fingerprint': fingerprint,
      if (appVersion != null) 'app_version': appVersion,
      if (osVersion != null) 'os_version': osVersion,
    });

    final data = Map<String, dynamic>.from((res.data as Map)['data'] as Map);
    final identity = PosTerminalIdentity.fromJson(data);

    // Persist only after the server accepted the registration.
    await _storage.write(key: _kSeed, value: base64Encode(seed));
    await _storage.write(key: _kIdentity, value: jsonEncode(identity.toJson()));
    await _storage.delete(key: _kDeviceToken);
    await _storage.delete(key: _kDeviceTokenExp);
    return identity;
  }

  /// Returns a valid device token, running the sign-in challenge if needed.
  /// Null when this device isn't registered (grandfather mode — caller falls
  /// back to the normal login path).
  Future<String?> ensureDeviceToken() async {
    final identity = await loadIdentity();
    final seedB64 = await _storage.read(key: _kSeed);
    if (identity == null || seedB64 == null || seedB64.trim().isEmpty) return null;

    final cached = await _storage.read(key: _kDeviceToken);
    final expStr = await _storage.read(key: _kDeviceTokenExp);
    final exp = int.tryParse(expStr ?? '') ?? 0;
    if (cached != null && cached.isNotEmpty && exp > DateTime.now().millisecondsSinceEpoch + 60000) {
      return cached;
    }

    final keyPair = await _ed25519.newKeyPairFromSeed(base64Decode(seedB64));

    final challengeRes = await _dio.post('/pos-terminals/device/challenge', data: {'terminal_id': identity.terminalId});
    final challenge = '${(challengeRes.data as Map)['data']['challenge']}';

    final signature = await _ed25519.sign(utf8.encode(challenge), keyPair: keyPair);
    final tokenRes = await _dio.post('/pos-terminals/device/token', data: {
      'challenge': challenge,
      'signature': base64Encode(signature.bytes),
    });

    final data = Map<String, dynamic>.from((tokenRes.data as Map)['data'] as Map);
    final token = '${data['device_token']}';
    final ttlHours = int.tryParse('${data['expires_in_hours'] ?? 12}') ?? 12;
    await _storage.write(key: _kDeviceToken, value: token);
    await _storage.write(
      key: _kDeviceTokenExp,
      value: '${DateTime.now().millisecondsSinceEpoch + ttlHours * 3600 * 1000}',
    );
    return token;
  }

  /// The device token to attach to outgoing requests, if one is cached. Kept
  /// side-effect-free so the request interceptor never triggers a network call.
  Future<String?> cachedDeviceToken() async {
    final token = await _storage.read(key: _kDeviceToken);
    if (token == null || token.trim().isEmpty) return null;
    return token;
  }

  /// Wipe local terminal identity (used after a server-side revoke/transfer).
  Future<void> clear() async {
    await _storage.delete(key: _kIdentity);
    await _storage.delete(key: _kSeed);
    await _storage.delete(key: _kDeviceToken);
    await _storage.delete(key: _kDeviceTokenExp);
  }
}

final posTerminalServiceProvider = Provider<PosTerminalService>((ref) {
  return PosTerminalService(ref.read(dioProvider), ref.read(secureStorageProvider));
});

/// Resolves this device's registered terminal identity (null = not registered).
final posTerminalIdentityProvider = FutureProvider<PosTerminalIdentity?>((ref) {
  return ref.read(posTerminalServiceProvider).loadIdentity();
});
