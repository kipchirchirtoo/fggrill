import 'dart:io' show Platform, File, Directory;

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
bool _isExitingFullScreen = false;
bool _renderCrashCaptured = false;
bool _layoutCrashCaptured = false;
bool _buildCrashCaptured = false;

bool get _isDesktop =>
    !kIsWeb && (Platform.isWindows || Platform.isLinux || Platform.isMacOS);

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  tz.initializeTimeZones(); // KENYA TIME
  ensureStableWorkingDirectory();

  // Desktop: start from a stable normal window, then enter full screen.
  // On Windows, creating the window directly in fullScreen mode can leave the
  // window with a bad restore target; pressing Esc then appears to minimize or
  // hide the app instead of returning to a usable normal window.
  if (_isDesktop) {
    await windowManager.ensureInitialized();
    await windowManager.waitUntilReadyToShow(
      const WindowOptions(
        title: 'FamousGate Hotels System',
        center: true,
        size: Size(1440, 900),
        minimumSize: Size(800, 580),
      ),
      () async {
        await windowManager.show();
        await windowManager.focus();
        await windowManager.setFullScreen(true);
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

    // ── TEMP DIAGNOSTIC: capture the first render/semantics-corruption error ──
    // The cashier station floods the console with `!semantics.parentDataDirty`,
    // `child._parent == this`, and "no size" hit-test errors every frame,
    // hanging the app. Those follow-on errors are all cascade noise — only the
    // FIRST one carries a useful stack. Dump that first stack to a file we can
    // read, then swallow the flood so the app stops hanging and we can see
    // whether content renders.
    final isLayoutRecursion = message.contains('Stack Overflow') ||
        message.contains('Stack overflow') ||
        message.contains('was not laid out') ||
        message.contains('RenderBox was not laid out');
    final isRenderCorruption = message.contains('parentDataDirty') ||
        message.contains('child._parent == this') ||
        message.contains('hit test a render box with no size') ||
        message.contains('_debugRelayoutBoundaryAlreadyMarkedNeedsLayout');
    if (isLayoutRecursion || isRenderCorruption) {
      // The layout-recursion stack names the offending widget (a repeating
      // frame). Prioritise capturing THAT over the semantics cascade.
      final wantCapture = isLayoutRecursion
          ? !_layoutCrashCaptured
          : (!_renderCrashCaptured && !_layoutCrashCaptured);
      if (wantCapture) {
        if (isLayoutRecursion) _layoutCrashCaptured = true;
        _renderCrashCaptured = true;
        try {
          final buffer = StringBuffer()
            ..writeln('=== FIRST ${isLayoutRecursion ? 'LAYOUT-RECURSION' : 'RENDER-CORRUPTION'} ERROR ===')
            ..writeln(DateTime.now().toIso8601String())
            ..writeln(details.toStringShort())
            ..writeln('--- exception ---')
            ..writeln(details.exception.toString())
            ..writeln('--- stack (first 120 frames) ---');
          final frames =
              (details.stack?.toString() ?? '(no stack)').split('\n');
          buffer.writeln(frames.take(120).join('\n'));
          final name = isLayoutRecursion
              ? 'fggrill_cashier_layout_crash.txt'
              : 'fggrill_cashier_crash.txt';
          final file = File('${Directory.systemTemp.path}/$name');
          file.writeAsStringSync(buffer.toString());
          debugPrint('■■■ Cashier crash stack written to: ${file.path} ■■■');
        } catch (_) {}
        FlutterError.presentError(details);
      }
      // Swallow the per-frame cascade so the UI thread isn't saturated.
      return;
    }

    FlutterError.presentError(details);
  };
  ErrorWidget.builder = (details) {
    // Capture the FIRST build-time exception (the one this placeholder is
    // replacing) so a failing screen can be diagnosed from its real stack
    // instead of only the generic message below. One capture per session to
    // avoid disk thrash from the per-frame rebuild cascade.
    if (!_buildCrashCaptured) {
      _buildCrashCaptured = true;
      try {
        final buffer = StringBuffer()
          ..writeln('=== FIRST BUILD-TIME (ErrorWidget) ERROR ===')
          ..writeln(DateTime.now().toIso8601String())
          ..writeln(details.toStringShort())
          ..writeln('--- library: ${details.library} ---')
          ..writeln('--- context: ${details.context} ---')
          ..writeln('--- exception ---')
          ..writeln(details.exception.toString())
          ..writeln('--- stack (first 100 frames) ---')
          ..writeln((details.stack?.toString() ?? '(no stack)')
              .split('\n')
              .take(100)
              .join('\n'));
        final file =
            File('${Directory.systemTemp.path}/fggrill_widget_build_crash.txt');
        file.writeAsStringSync(buffer.toString());
        debugPrint('■■■ Widget build crash written to: ${file.path} ■■■');
      } catch (_) {}
    }
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
            if (!kIsWeb && Platform.isMacOS)
              const SingleActivator(LogicalKeyboardKey.keyR, meta: true): () =>
                  triggerGlobalRefresh(ref),
            const SingleActivator(LogicalKeyboardKey.f5): () =>
                triggerGlobalRefresh(ref),
            // Esc leaves full screen. Dialogs and menus handle Esc closer to
            // the focus first, so this only fires when nothing else consumed
            // it — closing a dialog will not also drop out of full screen.
            const SingleActivator(LogicalKeyboardKey.escape): () async {
              if (!_isDesktop || _isExitingFullScreen) return;
              if (await windowManager.isFullScreen()) {
                _isExitingFullScreen = true;
                try {
                  await windowManager.setFullScreen(false);
                  if (await windowManager.isMinimized()) {
                    await windowManager.restore();
                  }
                  await windowManager.show();
                  await windowManager.focus();
                  if (Platform.isWindows) {
                    await windowManager.maximize();
                  }
                } finally {
                  _isExitingFullScreen = false;
                }
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
