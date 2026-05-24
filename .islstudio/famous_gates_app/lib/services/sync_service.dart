import 'dart:async';
import 'package:connectivity_plus/connectivity_plus.dart';

class SyncService {
  Timer? _timer;

  SyncService();

  void start() {
    _timer = Timer.periodic(const Duration(seconds: 30), (timer) async {
      final connectivityResult = await Connectivity().checkConnectivity();
      if (connectivityResult.first != ConnectivityResult.none) {
        await _syncPendingSales();
      }
    });
  }

  Future<void> _syncPendingSales() async {
    // Logic to fetch unsynced sales from Drift and POST to /sales/sync-batch
  }

  void stop() {
    _timer?.cancel();
  }
}
