import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:cryptography/cryptography.dart';
import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:path_provider/path_provider.dart';
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
    try {
      final raw = await _storage.read(key: _kIdentity);
      if (raw != null && raw.trim().isNotEmpty) {
        return PosTerminalIdentity.fromJson(jsonDecode(raw) as Map<String, dynamic>);
      }
    } catch (_) {
      // fall through to the file backup
    }
    // Secure storage empty or unreadable (e.g. wiped by an app reinstall) —
    // recover from the resilient file backup and re-hydrate secure storage so
    // device auth keeps working, instead of forcing a re-registration.
    final backup = await _readBackup();
    if (backup == null) return null;
    try {
      final identity = PosTerminalIdentity.fromJson(
          Map<String, dynamic>.from(backup['identity'] as Map));
      final seed = '${backup['seed'] ?? ''}';
      final fingerprint = '${backup['fingerprint'] ?? ''}';
      await _storage.write(key: _kIdentity, value: jsonEncode(identity.toJson()));
      if (seed.isNotEmpty) await _storage.write(key: _kSeed, value: seed);
      if (fingerprint.isNotEmpty) await _storage.write(key: _kFingerprint, value: fingerprint);
      return identity;
    } catch (_) {
      return null;
    }
  }

  // ---- Resilient file backup ---------------------------------------
  // Secure storage can be wiped by an app reinstall on some platforms; a plain
  // JSON file in the app-support directory survives updates so a registered
  // terminal is not forced to re-enroll. It holds the (sensitive) device seed,
  // so it lives only on the POS machine.
  Future<File?> _backupFile() async {
    try {
      final sep = Platform.pathSeparator;
      // Prefer a FIXED, build-independent directory so the identity is shared by
      // every build/install on this machine (installer, dev run, and updates all
      // resolve the same file), and survives an app uninstall. getApplicationSupportDirectory
      // is app-identity-specific and differs between debug/release/installer, so
      // it is only a last resort.
      String? base;
      if (Platform.isWindows) {
        base = Platform.environment['LOCALAPPDATA'] ??
            Platform.environment['PROGRAMDATA'] ??
            Platform.environment['APPDATA'];
      } else {
        base = Platform.environment['HOME'];
      }
      base ??= (await getApplicationSupportDirectory()).path;
      if (base.trim().isEmpty) return null;
      final dir = Directory('$base${sep}FamousGateTerminal');
      if (!await dir.exists()) await dir.create(recursive: true);
      return File('${dir.path}${sep}pos_terminal_identity.json');
    } catch (_) {
      return null;
    }
  }

  Future<void> _writeBackup(
      PosTerminalIdentity identity, String seedB64, String fingerprint) async {
    try {
      final file = await _backupFile();
      if (file == null) return;
      await file.writeAsString(jsonEncode({
        'identity': identity.toJson(),
        'seed': seedB64,
        'fingerprint': fingerprint,
      }));
    } catch (_) {}
  }

  Future<Map<String, dynamic>?> _readBackup() async {
    try {
      final file = await _backupFile();
      if (file == null || !await file.exists()) return null;
      final raw = await file.readAsString();
      if (raw.trim().isEmpty) return null;
      return Map<String, dynamic>.from(jsonDecode(raw) as Map);
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
    final seedB64 = base64Encode(seed);
    await _storage.write(key: _kSeed, value: seedB64);
    await _storage.write(key: _kIdentity, value: jsonEncode(identity.toJson()));
    await _storage.delete(key: _kDeviceToken);
    await _storage.delete(key: _kDeviceTokenExp);
    // Resilient backup so a reinstall/secure-store wipe does not force re-enroll.
    await _writeBackup(identity, seedB64, fingerprint);
    return identity;
  }

  /// Returns a valid device token, running the sign-in challenge if needed.
  /// Null when this device isn't registered (grandfather mode — caller falls
  /// back to the normal login path).
  Future<String?> ensureDeviceToken() async {
    final identity = await loadIdentity();
    final seedB64 = await _storage.read(key: _kSeed);
    final seedPresent = seedB64 != null && seedB64.trim().isNotEmpty;
    debugPrint('[PosTerminal] ensureDeviceToken: registered=${identity != null} seedPresent=$seedPresent');
    if (identity == null || !seedPresent) return null;

    final cached = await _storage.read(key: _kDeviceToken);
    final expStr = await _storage.read(key: _kDeviceTokenExp);
    final exp = int.tryParse(expStr ?? '') ?? 0;
    if (cached != null && cached.isNotEmpty && exp > DateTime.now().millisecondsSinceEpoch + 60000) {
      debugPrint('[PosTerminal] ensureDeviceToken: using cached token (valid)');
      return cached;
    }

    debugPrint('[PosTerminal] ensureDeviceToken: minting via challenge/sign/token for ${identity.terminalId}');
    try {
      final keyPair = await _ed25519.newKeyPairFromSeed(base64Decode(seedB64!));

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
      debugPrint('[PosTerminal] ensureDeviceToken: minted OK (branch context will now be sent)');
      return token;
    } catch (e) {
      debugPrint('[PosTerminal] ensureDeviceToken: mint FAILED — $e');
      rethrow;
    }
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
    try {
      final file = await _backupFile();
      if (file != null && await file.exists()) await file.delete();
    } catch (_) {}
  }
}

final posTerminalServiceProvider = Provider<PosTerminalService>((ref) {
  return PosTerminalService(ref.read(dioProvider), ref.read(secureStorageProvider));
});

/// Resolves this device's registered terminal identity (null = not registered).
final posTerminalIdentityProvider = FutureProvider<PosTerminalIdentity?>((ref) {
  return ref.read(posTerminalServiceProvider).loadIdentity();
});

/// When true, the app blocks all use (PIN + back-office) until this device is
/// registered to a branch. Registration is a one-time first-run step; the bound
/// identity + key live in OS secure storage (user profile, not the install
/// folder), so it persists across app updates and is never asked again — only a
/// full uninstall / credential wipe clears it.
const bool kRequireTerminalRegistration = false;

class TerminalRegistrationStatus {
  const TerminalRegistrationStatus({required this.loaded, required this.registered});

  /// false until secure storage has been read once (so the gate never fires on
  /// a not-yet-known state and bounces a registered terminal).
  final bool loaded;
  final bool registered;
}

/// Synchronously-readable registration status for the router gate. Loaded once
/// at startup from secure storage; refreshed after a successful registration.
class TerminalRegistrationStatusNotifier extends StateNotifier<TerminalRegistrationStatus> {
  TerminalRegistrationStatusNotifier(this._ref)
      : super(const TerminalRegistrationStatus(loaded: false, registered: false));

  final Ref _ref;

  Future<void> load() async {
    final service = _ref.read(posTerminalServiceProvider);
    final identity = await service.loadIdentity();
    final registered = identity != null;
    if (mounted) {
      state = TerminalRegistrationStatus(loaded: true, registered: registered);
    }
    // Best-effort: mint/refresh the device token so requests carry branch
    // context. Never blocks the gate; safe offline.
    if (registered) {
      unawaited(service.ensureDeviceToken().catchError((_) => null));
    }
  }

  void refresh() => load();
}

final terminalRegistrationStatusProvider =
    StateNotifierProvider<TerminalRegistrationStatusNotifier, TerminalRegistrationStatus>((ref) {
  return TerminalRegistrationStatusNotifier(ref)..load();
});
