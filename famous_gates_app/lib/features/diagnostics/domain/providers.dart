import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../data/repository.dart';
import 'models.dart';

final apiHealthProvider = FutureProvider.autoDispose<SystemHealth>((ref) {
  return ref.read(diagnosticsRepositoryProvider).getApiHealth();
});

final servicesHealthProvider =
    FutureProvider.autoDispose<List<ServiceHealth>>((ref) {
  return ref.read(diagnosticsRepositoryProvider).checkAllServices();
});
