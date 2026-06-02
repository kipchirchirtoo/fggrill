import 'dart:convert';
import 'dart:io';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:http/http.dart' as http;
import 'package:package_info_plus/package_info_plus.dart';
import 'package:updat/updat.dart';

const githubReleaseApi =
    'https://api.github.com/repos/kipchirchirtoo/fggrill/releases/latest';

// Local marker of the GitHub release this install is running. Lets us detect
// ANY new release (new id) even when the version tag is not bumped.
const _installedReleaseKey = 'installed_github_release_id';
const _secureStorage = FlutterSecureStorage();

final Future<String> currentDesktopVersionFuture = resolveCurrentVersion();

Future<String> resolveCurrentVersion() async {
  final packageInfo = await PackageInfo.fromPlatform();
  return normalizeDesktopVersion(packageInfo.version);
}

Future<String?> _readInstalledReleaseId() async {
  try {
    return await _secureStorage.read(key: _installedReleaseKey);
  } catch (_) {
    return null;
  }
}

Future<void> _writeInstalledReleaseId(String id) async {
  try {
    await _secureStorage.write(key: _installedReleaseKey, value: id);
  } catch (_) {
    // non-fatal
  }
}

String _releaseIdOf(Map<String, dynamic> release) =>
    '${release['id'] ?? release['tag_name'] ?? release['published_at'] ?? ''}';

/// Compares two normalized semver strings. Returns true if [a] > [b].
bool _isHigherVersion(String a, String b) {
  List<int> parts(String v) =>
      v.split('-').first.split('.').map((p) => int.tryParse(p) ?? 0).toList();
  final pa = parts(a);
  final pb = parts(b);
  for (var i = 0; i < 3; i++) {
    final x = i < pa.length ? pa[i] : 0;
    final y = i < pb.length ? pb[i] : 0;
    if (x != y) return x > y;
  }
  return false;
}

/// Bumps the patch of a normalized version so `updat` registers an update
/// even when the GitHub tag was not version-bumped (any-change detection).
String _bumpPatch(String version) {
  final core = version.split('-').first.split('.');
  final major = int.tryParse(core.isNotEmpty ? core[0] : '0') ?? 0;
  final minor = int.tryParse(core.length > 1 ? core[1] : '0') ?? 0;
  final patch = (int.tryParse(core.length > 2 ? core[2] : '0') ?? 0) + 1;
  return '$major.$minor.$patch';
}

/// Call this once the user starts/launches an update so the new release is
/// recorded as installed and we stop flagging it.
Future<void> markDesktopUpdateApplied() async {
  try {
    final release = await fetchLatestDesktopRelease();
    await _writeInstalledReleaseId(_releaseIdOf(release));
  } catch (_) {
    // non-fatal
  }
}

// Cache the release payload briefly so a single update cycle (version +
// changelog + binary url = 3 reads) makes ONE network call instead of three.
// GitHub's unauthenticated API allows only 60 requests/hour, so without this
// repeated checks get rate-limited (403) and the updater "stops working".
Map<String, dynamic>? _cachedRelease;
DateTime? _cachedAt;
const _releaseCacheTtl = Duration(minutes: 2);

Future<Map<String, dynamic>> fetchLatestDesktopRelease() async {
  final cached = _cachedRelease;
  final cachedAt = _cachedAt;
  if (cached != null &&
      cachedAt != null &&
      DateTime.now().difference(cachedAt) < _releaseCacheTtl) {
    return cached;
  }

  final response = await http.get(
    Uri.parse(githubReleaseApi),
    headers: const {
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  );
  if (response.statusCode != 200) {
    final detail = response.statusCode == 403
        ? ' (GitHub rate limit reached — try again shortly)'
        : response.statusCode == 404
            ? ' (no published release found)'
            : '';
    throw Exception(
        'Unable to check for desktop updates [${response.statusCode}]$detail');
  }

  final decoded = jsonDecode(response.body);
  if (decoded is! Map<String, dynamic>) {
    throw Exception('Invalid GitHub release response');
  }

  _cachedRelease = decoded;
  _cachedAt = DateTime.now();
  return decoded;
}

Future<String?> getLatestDesktopVersion() async {
  final release = await fetchLatestDesktopRelease();
  final current = await currentDesktopVersionFuture;
  final tagVersion =
      normalizeDesktopVersion(release['tag_name']?.toString() ?? '');
  final latestId = _releaseIdOf(release);
  final installedId = await _readInstalledReleaseId();

  // First run on this install: baseline to the current latest release so we
  // don't nag immediately. Still surface it if the published tag is genuinely
  // higher than the running build.
  if (installedId == null || installedId.isEmpty) {
    await _writeInstalledReleaseId(latestId);
    return _isHigherVersion(tagVersion, current) ? tagVersion : current;
  }

  // A genuinely higher version tag → report the real version.
  if (_isHigherVersion(tagVersion, current)) return tagVersion;

  // Same/older tag but a DIFFERENT GitHub release (new id / re-publish) →
  // any code change is detected, so flag an update by bumping the patch.
  if (installedId != latestId) return _bumpPatch(current);

  // Nothing changed.
  return current;
}

Future<String?> getDesktopReleaseNotes(
  String latestVersion,
  String appVersion,
) async {
  final release = await fetchLatestDesktopRelease();
  return release['body']?.toString();
}

Future<String> getDesktopBinaryUrl(String? latestVersion) async {
  final release = await fetchLatestDesktopRelease();
  final assets = (release['assets'] as List<dynamic>? ?? [])
      .whereType<Map<String, dynamic>>()
      .toList();

  bool assetMatches(String name, List<String> requiredParts) {
    final lowerName = name.toLowerCase();
    return requiredParts.every((part) => lowerName.contains(part));
  }

  final priority = Platform.isWindows
      ? <List<String>>[
          ['setup', 'x64.exe'],
          ['windows-x64-portable.zip'],
          ['windows', 'zip'],
        ]
      : Platform.isLinux
          ? <List<String>>[
              ['linux-x64.deb'],
              ['linux-x64.tar.gz'],
              ['linux', 'tar.gz'],
            ]
          : <List<String>>[];

  for (final parts in priority) {
    for (final asset in assets) {
      final name = asset['name']?.toString() ?? '';
      final url = asset['browser_download_url']?.toString() ?? '';
      if (url.isNotEmpty && assetMatches(name, parts)) return url;
    }
  }

  throw UnsupportedError(
      'No desktop update asset is available for this platform');
}

bool isDesktopUpdateAvailable(UpdatStatus status) {
  return status == UpdatStatus.available ||
      status == UpdatStatus.availableWithChangelog;
}

String normalizeDesktopVersion(String version) {
  final trimmed = version.trim();
  if (trimmed.isEmpty) return '0.0.0';

  // Strip leading "v"/"V" and any build metadata after "+".
  var core = trimmed.replaceFirst(RegExp(r'^[vV]'), '').split('+').first;

  // Separate any pre-release suffix (e.g. "-beta") so we only pad the numeric core.
  String suffix = '';
  final dashIndex = core.indexOf('-');
  if (dashIndex != -1) {
    suffix = core.substring(dashIndex); // keep "-beta" etc.
    core = core.substring(0, dashIndex);
  }

  // Pad to a valid 3-part semver (major.minor.patch). GitHub tags like
  // "v3.1" normalize to "3.1" which is NOT valid semver and breaks the
  // updat version comparison — so "3.1" -> "3.1.0", "3" -> "3.0.0".
  final parts = core.split('.').where((p) => p.isNotEmpty).toList();
  while (parts.length < 3) {
    parts.add('0');
  }
  final normalizedCore = parts.take(3).join('.');

  return '$normalizedCore$suffix';
}
