import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Global "refresh" signal. Bumped by the app-wide Ctrl+R / F5 shortcut.
///
/// Screens react in one of two ways:
///  - watch it and wrap their content in a `KeyedSubtree(key: ValueKey(tick))`
///    so the subtree rebuilds and reloads, or
///  - `ref.listen` to it and re-run their own refresh logic.
final globalRefreshTickProvider = StateProvider<int>((ref) => 0);

DateTime? _lastGlobalRefresh;

/// Trigger a global refresh from anywhere with a [WidgetRef]/[Ref].
///
/// Debounced: holding Ctrl+R/F5 triggers OS key-repeat, which would otherwise
/// fire this many times per second. Since each tick destroys and rebuilds the
/// active section's widget subtree (re-running its full data load), repeated
/// ticks within a short window are collapsed into one.
void triggerGlobalRefresh(WidgetRef ref) {
  final now = DateTime.now();
  if (_lastGlobalRefresh != null &&
      now.difference(_lastGlobalRefresh!) < const Duration(milliseconds: 800)) {
    return;
  }
  _lastGlobalRefresh = now;
  ref.read(globalRefreshTickProvider.notifier).state++;
}
