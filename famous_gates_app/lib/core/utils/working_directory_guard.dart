import 'dart:io';

/// Desktop debug builds can keep running while Flutter replaces build folders.
/// When that happens, Dart's current directory can become invalid and low-level
/// IO used by networking/storage may throw PathNotFoundException before a
/// request reaches the API.
void ensureStableWorkingDirectory() {
  if (!Platform.isLinux && !Platform.isMacOS && !Platform.isWindows) {
    return;
  }

  try {
    final exeDir = File(Platform.resolvedExecutable).parent;
    if (exeDir.existsSync()) {
      Directory.current = exeDir;
      return;
    }
  } catch (_) {
    // Fall through to fallback resolution below
  }

  final candidates = <Directory>[
    File(Platform.resolvedExecutable).parent,
    if ((Platform.environment['HOME'] ?? '').isNotEmpty)
      Directory(Platform.environment['HOME']!),
    Directory.systemTemp,
  ];

  for (final directory in candidates) {
    try {
      if (directory.existsSync()) {
        Directory.current = directory;
        return;
      }
    } on FileSystemException {
      // Try the next fallback.
    }
  }
}
