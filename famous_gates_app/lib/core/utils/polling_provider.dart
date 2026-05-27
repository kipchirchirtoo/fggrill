import 'dart:async';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// A StreamProvider that polls data at a specified interval
/// Use this as a fallback when WebSocket is not available
class PollingProvider<T> {
  final Future<T> Function() fetcher;
  final Duration interval;
  final T? initialData;

  PollingProvider({
    required this.fetcher,
    this.interval = const Duration(seconds: 5),
    this.initialData,
  });

  StreamProvider<T> create(String providerName) {
    return StreamProvider<T>((ref) {
      final controller = StreamController<T>.broadcast();
      Timer? timer;

      Future<void> fetch() async {
        try {
          final data = await fetcher();
          if (!controller.isClosed) {
            controller.add(data);
          }
        } catch (e) {
          if (!controller.isClosed) {
            controller.addError(e);
          }
        }
      }

      // Initial fetch
      fetch();

      // Set up polling
      timer = Timer.periodic(interval, (_) => fetch());

      // Cleanup on dispose
      ref.onDispose(() {
        timer?.cancel();
        controller.close();
      });

      return controller.stream;
    }, name: providerName);
  }
}
