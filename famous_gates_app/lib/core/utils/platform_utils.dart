import 'package:flutter/foundation.dart';

/// Utility to detect current platform type (desktop vs mobile).
/// Used to branch between desktop sidebar UI and mobile bottom-nav UI.
///
/// DEV OVERRIDE: pass `--dart-define=FORCE_MOBILE=true` to `flutter run` or
/// `flutter build` to force the mobile UI on Chrome / Linux desktop (useful for
/// testing without a physical device or emulator).
///
///   flutter run -d chrome --dart-define=FORCE_MOBILE=true
///   flutter run -d linux  --dart-define=FORCE_MOBILE=true
class AppPlatform {
  AppPlatform._();

  /// Compile-time flag set via `--dart-define=FORCE_MOBILE=true`.
  static const bool _forceMobile =
      bool.fromEnvironment('FORCE_MOBILE', defaultValue: false);

  /// Returns `true` when running on Android or iOS (or when the dev override
  /// is active).  Uses [defaultTargetPlatform] instead of `dart:io` so this
  /// file compiles cleanly on every target including Chrome / web.
  static bool get isMobile {
    if (_forceMobile) return true;
    if (kIsWeb) return false;
    return defaultTargetPlatform == TargetPlatform.android ||
        defaultTargetPlatform == TargetPlatform.iOS;
  }

  static bool get isDesktop => !isMobile;
}
