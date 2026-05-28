import 'dart:io';
import 'package:flutter/foundation.dart';

/// Utility to detect current platform type (desktop vs mobile).
/// Used to branch between desktop sidebar UI and mobile bottom-nav UI.
class AppPlatform {
  AppPlatform._();

  static bool get isMobile =>
      !kIsWeb && (Platform.isAndroid || Platform.isIOS);

  static bool get isDesktop =>
      kIsWeb || Platform.isWindows || Platform.isLinux || Platform.isMacOS;
}
