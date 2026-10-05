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

  // In-memory copies. When the PC loses power the secure-storage file (one file
  // that is rewritten on every write) can be left corrupt and every read/write
  // then throws. The seed/token/fingerprint must keep working from memory and
  // from the on-disk backup instead of the terminal "forgetting" it is enrolled.
  String? _memSeed;
  String? _memFingerprint;
  String? _memToken;
  int _memTokenExp = 0;

  // ---- Failure-tolerant secure-storage access ------------------------
  Future<String?> _safeRead(String key) async {
    try {
      return await _storage.read(key: key);
    } catch (e) {
      debugPrint('[PosTerminal] secure storage read "$key" failed — $e');
      return null;
    }
  }

  Future<void> _safeWrite(String key, String value) async {
    try {
      await _storage.write(key: key, value: value);
    } catch (e) {
      debugPrint('[PosTerminal] secure storage write "$key" failed — $e');
    }
  }

  Future<void> _safeDelete(String key) async {
    try {
      await _storage.delete(key: key);
    } catch (e) {
      debugPrint('[PosTerminal] secure storage delete "$key" failed — $e');
    }
  }

  /// True only when the server DEFINITIVELY says this terminal is gone, revoked
  /// or its key was replaced. Anything else (a 404/403 from a proxy or a deploy
  /// in progress, an expired challenge, no network, a 5xx) must NOT wipe the
  /// device identity — that is what forced re-enrollment before.
  static bool isDefinitiveRejection(Object e) {
    if (e is! DioException) return false;
    final code = e.response?.statusCode;
    final data = e.response?.data;
    final msg = (data is Map ? '${data['message'] ?? ''}' : '').toLowerCase();
    if (code == 404) return msg.contains('not registered');
    if (code == 403) return msg.contains('terminal is');
    if (code == 401) return msg.contains('signature');
    return false;
  }

  Future<PosTerminalIdentity?> loadIdentity() async {
    // 1. Secure storage (may be unreadable after a power cut).
    final raw = await _safeRead(_kIdentity);
    if (raw != null && raw.trim().isNotEmpty) {
      try {
        final id = PosTerminalIdentity.fromJson(jsonDecode(raw) as Map<String, dynamic>);
        if (id.status.isNotEmpty && id.status != 'active') {
          await clear();
          return null;
        }
        return id;
      } catch (_) {
        // corrupt value — fall through to the file backup
      }
    }

    // 2. On-disk backup (two atomic copies). Recovering from it must never fail
    // just because secure storage is also damaged: re-hydrating secure storage
    // is best-effort and the identity is returned regardless.
    final backup = await _readBackup();
    if (backup == null) return null;
    try {
      final identity = PosTerminalIdentity.fromJson(
          Map<String, dynamic>.from(backup['identity'] as Map));
      if (identity.status.isNotEmpty && identity.status != 'active') {
        await clear();
        return null;
      }
      final seed = '${backup['seed'] ?? ''}';
      final fingerprint = '${backup['fingerprint'] ?? ''}';
      if (seed.isNotEmpty) _memSeed = seed;
      if (fingerprint.isNotEmpty) _memFingerprint = fingerprint;
      await _safeWrite(_kIdentity, jsonEncode(identity.toJson()));
      if (seed.isNotEmpty) await _safeWrite(_kSeed, seed);
      if (fingerprint.isNotEmpty) await _safeWrite(_kFingerprint, fingerprint);
      return identity;
    } catch (_) {
      return null;
    }
  }

  // ---- Resilient file backup ---------------------------------------
  // Secure storage can be wiped by an app reinstall and corrupted by a power
  // cut; a plain JSON file in a user-profile directory survives updates so a
  // registered terminal is not forced to re-enroll. It holds the (sensitive)
  // device seed, so it lives only on the POS machine.
  //
  // Power-loss safety: every write is flushed to disk and written to a temp
  // file that is then renamed over the target, and a second full copy (.bak) is
  // kept. A cut in the middle of a write can therefore never destroy both.
  static File? backupFileSync() {
    try {
      if (kIsWeb) return null;
      final sep = Platform.pathSeparator;
      String? base;
      if (Platform.isWindows) {
        base = Platform.environment['LOCALAPPDATA'] ??
            Platform.environment['PROGRAMDATA'] ??
            Platform.environment['APPDATA'];
      } else {
        base = Platform.environment['HOME'];
      }
      if (base == null || base.trim().isEmpty) return null;
      final dir = Directory('$base${sep}FamousGateTerminal');
      return File('${dir.path}${sep}pos_terminal_identity.json');
    } catch (_) {
      return null;
    }
  }

  static File _bakOf(File primary) => File('${primary.path}.bak');

  /// Parses one backup file; null when missing, empty, truncated or invalid.
  static Map<String, dynamic>? _parseBackup(String raw) {
    try {
      if (raw.trim().isEmpty) return null;
      final decoded = jsonDecode(raw);
      if (decoded is! Map || decoded['identity'] is! Map) return null;
      final map = Map<String, dynamic>.from(decoded);
      PosTerminalIdentity.fromJson(Map<String, dynamic>.from(map['identity'] as Map));
      return map;
    } catch (_) {
      return null;
    }
  }

  /// Synchronous read used at startup (primary copy, then the .bak copy).
  static Map<String, dynamic>? readBackupSync() {
    try {
      final primary = backupFileSync();
      if (primary == null) return null;
      for (final file in [primary, _bakOf(primary)]) {
        try {
          if (!file.existsSync()) continue;
          final parsed = _parseBackup(file.readAsStringSync());
          if (parsed != null) return parsed;
        } catch (_) {}
      }
    } catch (_) {}
    return null;
  }

  Future<File?> _backupFile() async {
    try {
      final file = backupFileSync();
      if (file != null) {
        if (!await file.parent.exists()) {
          await file.parent.create(recursive: true);
        }
        return file;
      }
      final base = (await getApplicationSupportDirectory()).path;
      if (base.trim().isEmpty) return null;
      final sep = Platform.pathSeparator;
      final dir = Directory('$base${sep}FamousGateTerminal');
      if (!await dir.exists()) await dir.create(recursive: true);
      return File('${dir.path}${sep}pos_terminal_identity.json');
    } catch (_) {
      return null;
    }
  }

  /// Flushed write via temp file + rename, so a power cut leaves either the old
  /// complete file or the new complete file — never a half-written one.
  static Future<void> _atomicWrite(File target, String content) async {
    final tmp = File('${target.path}.tmp');
    try {
      await tmp.writeAsString(content, flush: true);
      await tmp.rename(target.path);
    } catch (_) {
      // Rename can fail (e.g. target locked) — fall back to a flushed direct write.
      await target.writeAsString(content, flush: true);
    }
  }

  Future<void> _writeBackup(
      PosTerminalIdentity identity, String seedB64, String fingerprint) async {
    try {
      final file = await _backupFile();
      if (file == null) return;
      final content = jsonEncode({
        'identity': identity.toJson(),
        'seed': seedB64,
        'fingerprint': fingerprint,
      });
      // Two independent full copies, written one after the other.
      await _atomicWrite(file, content);
      await _atomicWrite(_bakOf(file), content);
    } catch (e) {
      debugPrint('[PosTerminal] writing identity backup failed — $e');
    }
  }

  Future<Map<String, dynamic>?> _readBackup() async {
    try {
      final primary = await _backupFile();
      if (primary == null) return null;
      for (final file in [primary, _bakOf(primary)]) {
        try {
          if (!await file.exists()) continue;
          final parsed = _parseBackup(await file.readAsString());
          if (parsed != null) return parsed;
        } catch (_) {}
      }
    } catch (_) {}
    return null;
  }

  Future<bool> get isRegistered async {
    final identity = await loadIdentity();
    return identity != null && (identity.status.isEmpty || identity.status == 'active');
  }

  /// The device's Ed25519 seed: secure storage, then memory, then the backup.
  Future<String?> _loadSeed() async {
    final stored = await _safeRead(_kSeed);
    if (stored != null && stored.trim().isNotEmpty) {
      _memSeed = stored;
      return stored;
    }
    if (_memSeed != null && _memSeed!.isNotEmpty) return _memSeed;
    final backup = await _readBackup();
    final fromBackup = '${backup?['seed'] ?? ''}';
    if (fromBackup.isNotEmpty) {
      _memSeed = fromBackup;
      await _safeWrite(_kSeed, fromBackup);
      return fromBackup;
    }
    return null;
  }

  /// Stable per-install fingerprint (generated once, then reused).
  Future<String> _fingerprint() async {
    final existing = await _safeRead(_kFingerprint);
    if (existing != null && existing.trim().isNotEmpty) {
      _memFingerprint = existing;
      return existing;
    }
    if (_memFingerprint != null && _memFingerprint!.isNotEmpty) return _memFingerprint!;
    final backup = await _readBackup();
    final fromBackup = '${backup?['fingerprint'] ?? ''}';
    if (fromBackup.isNotEmpty) {
      _memFingerprint = fromBackup;
      return fromBackup;
    }
    final fp = _uuid.v4();
    _memFingerprint = fp;
    await _safeWrite(_kFingerprint, fp);
    return fp;
  }

  /// Step 1 — validate an enrollment code and return what it binds to. Does not
  /// consume the code.
  Future<Map<String, dynamic>> verifyCode(String code) async {
    final res = await _dio.post('/pos-terminals/enroll/verify', data: {'code': code.trim()});
    return Map<String, dynamic>.from((res.data as Map)['data'] as Map);
  }

  /// Step 2 — generate the device keypair, consume the code, and bind this
  /// device to the terminal. The private seed never leaves this machine.
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

    // The code is now consumed server-side, so the new key MUST NOT be lost:
    // write the flushed on-disk backup first, then secure storage best-effort.
    final seedB64 = base64Encode(seed);
    _memSeed = seedB64;
    _memToken = null;
    _memTokenExp = 0;
    await _writeBackup(identity, seedB64, fingerprint);
    await _safeWrite(_kSeed, seedB64);
    await _safeWrite(_kIdentity, jsonEncode(identity.toJson()));
    await _safeDelete(_kDeviceToken);
    await _safeDelete(_kDeviceTokenExp);
    return identity;
  }

  /// Returns a valid device token, running the sign-in challenge if needed.
  /// Null when this device isn't registered (grandfather mode — caller falls
  /// back to the normal login path).
  Future<String?> ensureDeviceToken() async {
    final identity = await loadIdentity();
    final seedB64 = await _loadSeed();
    final seedPresent = seedB64 != null && seedB64.trim().isNotEmpty;
    debugPrint('[PosTerminal] ensureDeviceToken: registered=${identity != null} seedPresent=$seedPresent');
    if (identity == null || !seedPresent) return null;

    if (_memToken != null && _memToken!.isNotEmpty && _memTokenExp > DateTime.now().millisecondsSinceEpoch + 60000) {
      return _memToken;
    }
    final cached = await _safeRead(_kDeviceToken);
    final expStr = await _safeRead(_kDeviceTokenExp);
    final exp = int.tryParse(expStr ?? '') ?? 0;
    if (cached != null && cached.isNotEmpty && exp > DateTime.now().millisecondsSinceEpoch + 60000) {
      debugPrint('[PosTerminal] ensureDeviceToken: using cached token (valid)');
      _memToken = cached;
      _memTokenExp = exp;
      return cached;
    }

    debugPrint('[PosTerminal] ensureDeviceToken: minting via challenge/sign/token for ${identity.terminalId}');
    try {
      final keyPair = await _ed25519.newKeyPairFromSeed(base64Decode(seedB64));
      Map<String, dynamic> data;
      try {
        data = await _mintToken(identity, keyPair);
      } on DioException catch (e) {
        // A challenge that expired in flight is not a rejection — ask for a new
        // one once before giving up.
        final body = e.response?.data;
        final msg = (body is Map ? '${body['message'] ?? ''}' : '').toLowerCase();
        if (e.response?.statusCode == 401 && msg.contains('challenge')) {
          data = await _mintToken(identity, keyPair);
        } else {
          rethrow;
        }
      }

      final token = '${data['device_token']}';
      final ttlHours = int.tryParse('${data['expires_in_hours'] ?? 12}') ?? 12;
      final expiresAt = DateTime.now().millisecondsSinceEpoch + ttlHours * 3600 * 1000;
      _memToken = token;
      _memTokenExp = expiresAt;
      await _safeWrite(_kDeviceToken, token);
      await _safeWrite(_kDeviceTokenExp, '$expiresAt');
      debugPrint('[PosTerminal] ensureDeviceToken: minted OK (branch context will now be sent)');
      return token;
    } catch (e) {
      debugPrint('[PosTerminal] ensureDeviceToken: mint FAILED — $e');
      if (isDefinitiveRejection(e)) {
        debugPrint('[PosTerminal] ensureDeviceToken: terminal rejected by server. Clearing local identity.');
        await clear();
      }
      rethrow;
    }
  }

  Future<Map<String, dynamic>> _mintToken(PosTerminalIdentity identity, SimpleKeyPair keyPair) async {
    final challengeRes = await _dio.post('/pos-terminals/device/challenge', data: {'terminal_id': identity.terminalId});
    final challenge = '${(challengeRes.data as Map)['data']['challenge']}';

    final signature = await _ed25519.sign(utf8.encode(challenge), keyPair: keyPair);
    final tokenRes = await _dio.post('/pos-terminals/device/token', data: {
      'challenge': challenge,
      'signature': base64Encode(signature.bytes),
    });
    return Map<String, dynamic>.from((tokenRes.data as Map)['data'] as Map);
  }

  /// Checks whether this device's registered terminal is still active on the server.
  /// If revoked or not found, clears local identity and returns null.
  /// If branch changed, updates local identity and cached token.
  Future<PosTerminalIdentity?> verifyWithServer() async {
    final identity = await loadIdentity();
    if (identity == null) return null;

    try {
      final res = await _dio.get(
        '/pos-terminals/device/status',
        queryParameters: {'terminal_id': identity.terminalId},
      );
      final data = Map<String, dynamic>.from((res.data as Map)['data'] as Map);
      final registered = data['registered'] == true;
      final status = '${data['status'] ?? ''}';

      if (!registered || status == 'revoked') {
        debugPrint('[PosTerminal] verifyWithServer: terminal ${identity.terminalId} is revoked/unregistered on server. Clearing local identity.');
        await clear();
        return null;
      }

      // If branch or name changed on server (e.g. transfer branch):
      final serverBranch = int.tryParse('${data['branch_id'] ?? 0}') ?? identity.branchId;
      final serverName = '${data['terminal_name'] ?? identity.terminalName}';
      final serverType = '${data['terminal_type'] ?? identity.terminalType}';
      if (serverBranch != identity.branchId || serverName != identity.terminalName || serverType != identity.terminalType) {
        debugPrint('[PosTerminal] verifyWithServer: terminal updated on server (branch $serverBranch). Updating local identity.');
        final updated = PosTerminalIdentity(
          terminalId: identity.terminalId,
          terminalCode: identity.terminalCode,
          terminalName: serverName,
          terminalType: serverType,
          branchId: serverBranch,
          status: status,
        );
        final seedB64 = await _loadSeed() ?? '';
        final fp = await _fingerprint();
        _memToken = null;
        _memTokenExp = 0;
        await _writeBackup(updated, seedB64, fp);
        await _safeWrite(_kIdentity, jsonEncode(updated.toJson()));
        await _safeDelete(_kDeviceToken);
        await _safeDelete(_kDeviceTokenExp);
        return updated;
      }

      return identity;
    } catch (e) {
      debugPrint('[PosTerminal] verifyWithServer check failed (offline or network error) — $e');
      return identity;
    }
  }

  /// The device token to attach to outgoing requests, if one is cached. Kept
  /// side-effect-free so the request interceptor never triggers a network call.
  Future<String?> cachedDeviceToken() async {
    final token = await _safeRead(_kDeviceToken);
    if (token != null && token.trim().isNotEmpty) return token;
    if (_memToken != null && _memToken!.isNotEmpty && _memTokenExp > DateTime.now().millisecondsSinceEpoch) {
      return _memToken;
    }
    return null;
  }

  /// Wipe local terminal identity (used after a server-side revoke/transfer).
  Future<void> clear() async {
    _memSeed = null;
    _memToken = null;
    _memTokenExp = 0;
    await _safeDelete(_kIdentity);
    await _safeDelete(_kSeed);
    await _safeDelete(_kDeviceToken);
    await _safeDelete(_kDeviceTokenExp);
    try {
      final primary = await _backupFile();
      if (primary != null) {
        for (final file in [primary, _bakOf(primary), File('${primary.path}.tmp'), File('${_bakOf(primary).path}.tmp')]) {
          try {
            if (await file.exists()) await file.delete();
          } catch (_) {}
        }
      }
    } catch (_) {}
  }
}

final posTerminalServiceProvider = Provider<PosTerminalService>((ref) {
  return PosTerminalService(ref.read(dioProvider), ref.read(secureStorageProvider));
});

/// Resolves this device's registered terminal identity (null = not registered).
/// Verifies with the server so revoked or transferred terminals are immediately reflected.
final posTerminalIdentityProvider = FutureProvider<PosTerminalIdentity?>((ref) async {
  return ref.read(posTerminalServiceProvider).verifyWithServer();
});

/// When true, the app blocks all use (PIN + back-office) until this device is
/// registered to a branch. Registration is a one-time first-run step; the bound
/// identity + key live in OS secure storage (user profile, not the install
/// folder), so it persists across app updates and is never asked again — only a
/// full uninstall / credential wipe clears it.
const bool kRequireTerminalRegistration = true;

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
      : super(_initialState());

  final Ref _ref;

  static TerminalRegistrationStatus _initialState() {
    // Read the on-disk backup (primary, then the .bak copy). A missing or
    // unreadable file must NOT be treated as "not registered": after a power cut
    // it can be absent/corrupt while secure storage is intact (or the other way
    // round). Stay `loaded: false` so the router waits for load(), which checks
    // every source, instead of bouncing an enrolled terminal to enrollment.
    final backup = PosTerminalService.readBackupSync();
    if (backup != null) {
      try {
        final identity = PosTerminalIdentity.fromJson(
            Map<String, dynamic>.from(backup['identity'] as Map));
        final registered = identity.status.isEmpty || identity.status == 'active';
        return TerminalRegistrationStatus(loaded: true, registered: registered);
      } catch (_) {}
    }
    return const TerminalRegistrationStatus(loaded: false, registered: false);
  }

  Future<void> load() async {
    final service = _ref.read(posTerminalServiceProvider);
    final identity = await service.verifyWithServer();
    final registered = identity != null && (identity.status.isEmpty || identity.status == 'active');
    if (mounted) {
      state = TerminalRegistrationStatus(loaded: true, registered: registered);
    }
    // Best-effort: mint/refresh the device token so requests carry branch
    // context. Never blocks the gate; safe offline.
    if (registered) {
      try {
        await service.ensureDeviceToken();
      } catch (e) {
        // ensureDeviceToken already wiped the identity if (and only if) the
        // server definitively rejected this terminal; mirror that in the gate.
        // Any other failure (offline, proxy 404/403, 5xx) keeps the terminal enrolled.
        if (PosTerminalService.isDefinitiveRejection(e)) {
          await service.clear();
          _ref.invalidate(posTerminalIdentityProvider);
          if (mounted) {
            state = const TerminalRegistrationStatus(loaded: true, registered: false);
          }
        }
      }
    }
  }

  Future<void> refresh() => load();
}

final terminalRegistrationStatusProvider =
    StateNotifierProvider<TerminalRegistrationStatusNotifier, TerminalRegistrationStatus>((ref) {
  return TerminalRegistrationStatusNotifier(ref)..load();
});
