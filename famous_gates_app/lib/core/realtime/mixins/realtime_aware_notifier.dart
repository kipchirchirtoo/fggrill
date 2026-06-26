import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// A mixin for StateNotifiers or other Notifiers to track active streams
/// and automatically cancel them when the notifier is disposed.
mixin RealtimeAwareNotifierMixin<T> on StateNotifier<T> {
  final List<StreamSubscription<dynamic>> _subscriptions = [];

  /// Registers a subscription to be cancelled when this notifier is disposed.
  void trackSubscription(StreamSubscription<dynamic> subscription) {
    _subscriptions.add(subscription);
  }

  /// Cancels all tracked subscriptions. Call this in dispose().
  void cancelAllSubscriptions() {
    for (final sub in _subscriptions) {
      sub.cancel();
    }
    _subscriptions.clear();
    debugPrint('🔌 RealtimeAwareNotifierMixin: Cancelled all subscriptions.');
  }

  @override
  void dispose() {
    cancelAllSubscriptions();
    super.dispose();
  }
}
