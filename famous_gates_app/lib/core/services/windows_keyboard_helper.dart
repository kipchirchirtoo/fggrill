import 'dart:io';
import 'package:flutter/foundation.dart';

/// Helper utility to invoke the Windows Touch Keyboard (TabTip / OSK) on Windows HP tablets
/// and touch screen devices when text fields are tapped or focused.
class WindowsKeyboardHelper {
  WindowsKeyboardHelper._();

  static DateTime? _lastTrigger;

  /// Fire-and-forget launch of [executable] — deliberately not awaited by
  /// callers (a text field tap shouldn't block on a keyboard process
  /// spawning), but that means a failure (e.g. TabTip.exe refusing to
  /// launch with "The requested operation requires elevation" on a
  /// non-admin session, which is the normal case on most terminals) used
  /// to reject the Future with nothing attached to observe it — Dart
  /// surfaces that as a top-level unhandled exception, spamming a full
  /// stack trace on every single tap. Wrapping the await in its own
  /// try/catch (rather than relying on the caller's, which only sees
  /// synchronous throws) actually observes it instead.
  static void _runSilently(String executable, List<String> args) {
    () async {
      try {
        await Process.run(executable, args);
      } catch (error) {
        debugPrint(
            'WindowsKeyboardHelper: failed to launch $executable: $error');
      }
    }();
  }

  /// Programmatically opens the Windows Touch Keyboard (TabTip.exe or OSK.exe)
  static void openVirtualKeyboard() {
    if (kIsWeb || !Platform.isWindows) return;

    final now = DateTime.now();
    if (_lastTrigger != null &&
        now.difference(_lastTrigger!) < const Duration(milliseconds: 400)) {
      return;
    }
    _lastTrigger = now;

    try {
      // 1. Primary: Direct launch of Windows Touch Keyboard (TabTip.exe)
      const tabtipPath =
          r'C:\Program Files\Common Files\microsoft shared\ink\TabTip.exe';
      if (File(tabtipPath).existsSync()) {
        _runSilently(tabtipPath, []);
        return;
      }
      // 2. Fallback: Launch tabtip protocol via cmd
      _runSilently('cmd.exe', ['/c', 'start', 'tabtip:']);
    } catch (e) {
      // 3. Fallback: Launch Windows On-Screen Keyboard (osk.exe)
      _runSilently('cmd.exe', ['/c', 'start', 'osk.exe']);
    }
  }
}
