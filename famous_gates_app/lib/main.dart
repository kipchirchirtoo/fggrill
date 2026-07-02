import 'dart:io' show Platform;

import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:updat/updat.dart';
import 'package:updat/updat_window_manager.dart';
import 'package:timezone/data/latest.dart' as tz; // KENYA TIME
import 'package:window_manager/window_manager.dart';

import 'core/router/app_router.dart';
import 'core/services/desktop_update_service.dart';
import 'core/state/app_refresh.dart';
import 'core/theme/app_theme.dart';
import 'core/utils/working_directory_guard.dart';

bool _updateNoticeShown = false;

bool get _isDesktop =>
    !kIsWeb && (Platform.isWindows || Platform.isLinux || Platform.isMacOS);

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  tz.initializeTimeZones(); // KENYA TIME
  ensureStableWorkingDirectory();

  // Desktop: launch in full screen. Esc exits full screen (see the app-wide
  // shortcut in FamousGatesApp below).
  if (_isDesktop) {
    await windowManager.ensureInitialized();
    await windowManager.waitUntilReadyToShow(
      const WindowOptions(
        fullScreen: true,
        title: 'FamousGate Hotels System',
      ),
      () async {
        await windowManager.show();
        await windowManager.focus();
      },
    );
  }
  FlutterError.onError = (details) {
    final message = details.exceptionAsString();
    if (message.contains('AssetManifest.bin') &&
        message.contains('Unable to load asset')) {
      debugPrint(
        'Ignored stale Flutter asset manifest error. Fully restart the app if an image is missing.',
      );
      return;
    }
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
      title: 'FamousGate Hotels System',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.lightTheme,
      routerConfig: router,
      builder: (context, child) {
        if (child == null) return const SizedBox.shrink();

        // App-wide keyboard shortcuts. CallbackShortcuts is additive — it does
        // NOT replace Flutter's default text shortcuts, so copy/paste/cut/
        // select-all (Ctrl+C/V/X/A) keep working inside fields. Ctrl+R and F5
        // raise a global refresh signal that screens react to.
        //
        final Widget wrapped = CallbackShortcuts(
          bindings: <ShortcutActivator, VoidCallback>{
            const SingleActivator(LogicalKeyboardKey.keyR, control: true): () =>
                triggerGlobalRefresh(ref),
            const SingleActivator(LogicalKeyboardKey.keyR, meta: true): () =>
                triggerGlobalRefresh(ref),
            const SingleActivator(LogicalKeyboardKey.f5): () =>
                triggerGlobalRefresh(ref),
            // Esc leaves full screen. Dialogs and menus handle Esc closer to
            // the focus first, so this only fires when nothing else consumed
            // it — closing a dialog will not also drop out of full screen.
            const SingleActivator(LogicalKeyboardKey.escape): () async {
              if (_isDesktop && await windowManager.isFullScreen()) {
                await windowManager.setFullScreen(false);
              }
            },
          },
          child: Focus(
            autofocus: true,
            child: child,
          ),
        );

        return FutureBuilder<String>(
          future: currentDesktopVersionFuture,
          builder: (context, snapshot) {
            final currentVersion = snapshot.data;
            if (currentVersion == null) return wrapped;

            return UpdatWindowManager(
              appName: 'FamousGate Hotels System',
              currentVersion: currentVersion,
              getLatestVersion: getLatestDesktopVersion,
              getBinaryUrl: getDesktopBinaryUrl,
              getChangelog: getDesktopReleaseNotes,
              openOnDownload: false,
              closeOnInstall: false,
              launchOnExit: false,
              callback: (status) {
                if (!_updateNoticeShown &&
                    (status == UpdatStatus.available ||
                        status == UpdatStatus.availableWithChangelog)) {
                  _updateNoticeShown = true;
                  ScaffoldMessenger.maybeOf(context)?.showSnackBar(
                    const SnackBar(
                      content: Text(
                          'A new FamousGate Hotels System desktop update is available. Use the update button in the top bar to download it.'),
                    ),
                  );
                }
              },
              child: wrapped,
            );
          },
        );
      },
    );
  }
}
