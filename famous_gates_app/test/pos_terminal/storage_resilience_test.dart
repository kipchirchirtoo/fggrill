import 'dart:convert';
import 'dart:io';

import 'package:dio/dio.dart';
import 'package:famous_gates_app/features/pos_terminal/data/pos_terminal_service.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';

/// Secure storage that can be told to fail every call, like a damaged Windows store.
class _FlakySecureStorage extends FlutterSecureStorage {
  _FlakySecureStorage();
  bool broken = false;
  final Map<String, String> data = {};

  @override
  Future<String?> read({required String key, IOSOptions? iOptions, AndroidOptions? aOptions, LinuxOptions? lOptions, WebOptions? webOptions, MacOsOptions? mOptions, WindowsOptions? wOptions}) async {
    if (broken) throw Exception('secure storage is corrupt');
    return data[key];
  }

  @override
  Future<void> write({required String key, required String? value, IOSOptions? iOptions, AndroidOptions? aOptions, LinuxOptions? lOptions, WebOptions? webOptions, MacOsOptions? mOptions, WindowsOptions? wOptions}) async {
    if (broken) throw Exception('secure storage is corrupt');
    if (value == null) {
      data.remove(key);
    } else {
      data[key] = value;
    }
  }

  @override
  Future<void> delete({required String key, IOSOptions? iOptions, AndroidOptions? aOptions, LinuxOptions? lOptions, WebOptions? webOptions, MacOsOptions? mOptions, WindowsOptions? wOptions}) async {
    if (broken) throw Exception('secure storage is corrupt');
    data.remove(key);
  }
}

Map<String, dynamic> _identity() => {
      'terminal_id': 't-1',
      'terminal_code': 'FG-B5-TEST',
      'terminal_name': 'Test POS',
      'terminal_type': 'restaurant',
      'branch_id': 5,
      'status': 'active',
    };

void main() {
  late Directory root;

  setUp(() {
    root = Directory.systemTemp.createTempSync('fg_terminal_test_');
    // Two independent locations, both inside the temp folder.
    PosTerminalService.debugSetBackupBases([
      '${root.path}${Platform.pathSeparator}loc1',
      '${root.path}${Platform.pathSeparator}loc2',
    ]);
  });
  tearDown(() {
    PosTerminalService.debugSetBackupBases(null);
    if (root.existsSync()) root.deleteSync(recursive: true);
  });

  PosTerminalService build(_FlakySecureStorage storage, String dir) {
    return PosTerminalService(Dio(), storage);
  }

  test('registration survives secure storage being destroyed (reads from the file copies)', () async {
    final dirA = Directory('${root.path}${Platform.pathSeparator}a')..createSync();
    final storage = _FlakySecureStorage();
    storage.data['pos_terminal_identity'] = jsonEncode(_identity());
    storage.data['pos_terminal_seed'] = base64Encode(List.filled(32, 7));
    final first = build(storage, dirA.path);

    // First start: loaded from secure storage; every file location is refreshed.
    expect((await first.loadIdentity())?.terminalCode, 'FG-B5-TEST');
    expect(File('${root.path}${Platform.pathSeparator}loc1${Platform.pathSeparator}FamousGateTerminal${Platform.pathSeparator}pos_terminal_identity.json').existsSync(), isTrue);
    expect(File('${root.path}${Platform.pathSeparator}loc2${Platform.pathSeparator}FamousGateTerminal${Platform.pathSeparator}pos_terminal_identity.json').existsSync(), isTrue);

    // Power cut / reinstall: secure storage is gone and unreadable.
    final broken = _FlakySecureStorage()..broken = true;
    final second = build(broken, dirA.path);
    expect((await second.loadIdentity())?.terminalCode, 'FG-B5-TEST');
  });

  test('losing one whole storage location still recovers from the other', () async {
    final dirA = Directory('${root.path}${Platform.pathSeparator}a')..createSync();
    final storage = _FlakySecureStorage();
    storage.data['pos_terminal_identity'] = jsonEncode(_identity());
    storage.data['pos_terminal_seed'] = base64Encode(List.filled(32, 7));
    await build(storage, dirA.path).loadIdentity();

    // Wipe ONE whole location (like a cleanup tool would) — the other still has it.
    Directory('${root.path}${Platform.pathSeparator}loc1').deleteSync(recursive: true);

    final broken = _FlakySecureStorage()..broken = true;
    expect((await build(broken, dirA.path).loadIdentity())?.terminalCode, 'FG-B5-TEST');
  });

  test('clear() with a reason removes every copy and writes the reason to the event log', () async {
    final dirA = Directory('${root.path}${Platform.pathSeparator}a')..createSync();
    final storage = _FlakySecureStorage();
    storage.data['pos_terminal_identity'] = jsonEncode(_identity());
    storage.data['pos_terminal_seed'] = base64Encode(List.filled(32, 7));
    final service = build(storage, dirA.path);
    await service.loadIdentity();

    await service.clear(reason: 'unit test');
    final folder = '${root.path}${Platform.pathSeparator}loc1${Platform.pathSeparator}FamousGateTerminal${Platform.pathSeparator}';
    expect(File('${folder}pos_terminal_identity.json').existsSync(), isFalse);
    expect(File('${folder}pos_terminal_identity.json.bak').existsSync(), isFalse);
    expect(File('${folder}pos_terminal_events.log').readAsStringSync(), contains('CLEARED — reason: unit test'));
    expect(PosTerminalService.readBackupSync(), isNull);
  });
}
