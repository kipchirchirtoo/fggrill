import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../data/repository.dart';

final vehiclesProvider =
    FutureProvider<List<Map<String, dynamic>>>((ref) async {
  final repo = ref.read(driverRepositoryProvider);
  return repo.getVehicles();
});
