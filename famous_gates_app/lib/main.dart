import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:updat/updat.dart';
import 'package:updat/updat_window_manager.dart';

import 'core/router/app_router.dart';
import 'core/services/desktop_update_service.dart';
import 'core/theme/app_theme.dart';

bool _updateNoticeShown = false;

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
          future: currentDesktopVersionFuture,
          builder: (context, snapshot) {
            final currentVersion = snapshot.data;
            if (currentVersion == null) return child;

            return UpdatWindowManager(
              appName: 'Famous Gates Hotels',
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
                          'A new Famous Gates desktop update is available. Use the update button in the top bar to download it.'),
                    ),
                  );
                }
              },
              child: child,
            );
          },
        );
      },
    );
  }
}
