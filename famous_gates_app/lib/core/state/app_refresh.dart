import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Global "refresh" signal. Bumped by the app-wide Ctrl+R / F5 shortcut.
///
/// Screens react in one of two ways:
///  - watch it and wrap their content in a `KeyedSubtree(key: ValueKey(tick))`
///    so the subtree rebuilds and reloads, or
///  - `ref.listen` to it and re-run their own refresh logic.
final globalRefreshTickProvider = StateProvider<int>((ref) => 0);

/// Trigger a global refresh from anywhere with a [WidgetRef]/[Ref].
void triggerGlobalRefresh(Ref ref) {
  ref.read(globalRefreshTickProvider.notifier).state++;
}
