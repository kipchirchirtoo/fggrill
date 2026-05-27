import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

final isOnlineProvider = StreamProvider<bool>((ref) {
  return Connectivity().onConnectivityChanged.map((results) {
    return results.isNotEmpty && !results.contains(ConnectivityResult.none);
  });
});

Future<bool> checkIsOnline() async {
  final results = await Connectivity().checkConnectivity();
  return results.isNotEmpty && !results.contains(ConnectivityResult.none);
}
