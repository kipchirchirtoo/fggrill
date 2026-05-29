import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:http/http.dart' as http;
import 'package:package_info_plus/package_info_plus.dart';
import 'package:updat/updat_window_manager.dart';

import 'core/router/app_router.dart';
import 'core/theme/app_theme.dart';

const _githubReleaseApi =
    'https://api.github.com/repos/kipchirchirtoo/fggrill/releases/latest';
final Future<String> _currentVersionFuture = _resolveCurrentVersion();

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  FlutterError.onError = (details) {
    FlutterError.presentError(details);
  };
  ErrorWidget.builder = (details) {
    return Material(
      color: const Color(0xFFF8FAFC),
      child: Center(
        child: Container(
          constraints: const BoxConstraints(maxWidth: 720),
          margin: const EdgeInsets.all(24),
          padding: const EdgeInsets.all(24),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: const Color(0xFFE5E7EB)),
          ),
          child: const Text(
            'Something went wrong while drawing this screen. Please refresh or open another module while the system recovers.',
            textAlign: TextAlign.center,
            style: TextStyle(
              color: Color(0xFF991B1B),
              fontWeight: FontWeight.w700,
            ),
          ),
        ),
      ),
    );
  };
  runApp(
    const ProviderScope(
      child: FamousGatesApp(),
    ),
  );
}

class FamousGatesApp extends ConsumerWidget {
  const FamousGatesApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final router = ref.watch(routerProvider);

    return MaterialApp.router(
      title: 'Famous Gates Hotels',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.lightTheme,
      routerConfig: router,
      builder: (context, child) {
        if (child == null) return const SizedBox.shrink();

        return FutureBuilder<String>(
          future: _currentVersionFuture,
          builder: (context, snapshot) {
            final currentVersion = snapshot.data;
            if (currentVersion == null) return child;

            return UpdatWindowManager(
              appName: 'Famous Gates Hotels',
              currentVersion: currentVersion,
              getLatestVersion: _getLatestDesktopVersion,
              getBinaryUrl: _getDesktopBinaryUrl,
              getChangelog: _getDesktopReleaseNotes,
              openOnDownload: false,
              closeOnInstall: false,
              launchOnExit: false,
              child: child,
            );
          },
        );
      },
    );
  }
}

Future<String> _resolveCurrentVersion() async {
  final packageInfo = await PackageInfo.fromPlatform();
  return _normalizeVersion(packageInfo.version);
}

Future<Map<String, dynamic>> _fetchLatestRelease() async {
  final response = await http.get(Uri.parse(_githubReleaseApi));
  if (response.statusCode != 200) {
    throw Exception('Unable to check for desktop updates');
  }

  final decoded = jsonDecode(response.body);
  if (decoded is! Map<String, dynamic>) {
    throw Exception('Invalid GitHub release response');
  }
  return decoded;
}

Future<String?> _getLatestDesktopVersion() async {
  final release = await _fetchLatestRelease();
  return _normalizeVersion(release['tag_name']?.toString() ?? '');
}

Future<String?> _getDesktopReleaseNotes(
  String latestVersion,
  String appVersion,
) async {
  final release = await _fetchLatestRelease();
  return release['body']?.toString();
}

Future<String> _getDesktopBinaryUrl(String? latestVersion) async {
  final release = await _fetchLatestRelease();
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
        ]
      : Platform.isLinux
          ? <List<String>>[
              ['linux-x64.deb'],
              ['linux-x64.tar.gz'],
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

String _normalizeVersion(String version) {
  final trimmed = version.trim();
  if (trimmed.isEmpty) return '0.0.0';
  return trimmed.replaceFirst(RegExp(r'^[vV]'), '').split('+').first;
}
