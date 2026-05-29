import 'dart:convert';
import 'dart:io';

import 'package:http/http.dart' as http;
import 'package:package_info_plus/package_info_plus.dart';
import 'package:updat/updat.dart';

const githubReleaseApi =
    'https://api.github.com/repos/kipchirchirtoo/fggrill/releases/latest';

final Future<String> currentDesktopVersionFuture = resolveCurrentVersion();

Future<String> resolveCurrentVersion() async {
  final packageInfo = await PackageInfo.fromPlatform();
  return normalizeDesktopVersion(packageInfo.version);
}

Future<Map<String, dynamic>> fetchLatestDesktopRelease() async {
  final response = await http.get(Uri.parse(githubReleaseApi));
  if (response.statusCode != 200) {
    throw Exception('Unable to check for desktop updates');
  }

  final decoded = jsonDecode(response.body);
  if (decoded is! Map<String, dynamic>) {
    throw Exception('Invalid GitHub release response');
  }
  return decoded;
}

Future<String?> getLatestDesktopVersion() async {
  final release = await fetchLatestDesktopRelease();
  return normalizeDesktopVersion(release['tag_name']?.toString() ?? '');
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
  return trimmed.replaceFirst(RegExp(r'^[vV]'), '').split('+').first;
}
