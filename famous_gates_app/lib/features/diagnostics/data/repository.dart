import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/network/dio_client.dart';
import '../domain/models.dart';

final diagnosticsRepositoryProvider = Provider<DiagnosticsRepository>((ref) {
  return DiagnosticsRepository(
    ref.read(dioProvider),
    ref.read(pythonDioProvider),
  );
});

class DiagnosticsRepository {
  DiagnosticsRepository(this._dio, this._pythonDio);

  final Dio _dio;
  final Dio _pythonDio;

  Future<SystemHealth> getApiHealth() async {
    final response = await _dio.get('/health');
    return SystemHealth.fromJson(response.data);
  }

  Future<ServiceHealth> _checkWith(Dio client, String name, String path) async {
    try {
      final stopwatch = Stopwatch()..start();
      final response = await client.get(path);
      stopwatch.stop();
      return ServiceHealth.fromJson(name, response.data)
          .copyWith(responseTimeMs: stopwatch.elapsedMilliseconds);
    } on DioException catch (e) {
      return ServiceHealth.error(name, e.message ?? 'Connection failed');
    }
  }

  Future<List<ServiceHealth>> checkAllServices() async {
    final results = <ServiceHealth>[];
    results.add(await _checkWith(_dio, 'Main API', '/health'));
    results.add(await _checkWith(_pythonDio, 'Python Services', '/health'));
    results.add(
        await _checkWith(_pythonDio, 'Pricing Engine', '/api/pricing/health'));
    results.add(await _checkWith(
        _pythonDio, 'Communication Hub', '/api/communications/health'));
    return results;
  }
}

extension on ServiceHealth {
  ServiceHealth copyWith({int? responseTimeMs}) {
    return ServiceHealth(
      name: name,
      isHealthy: isHealthy,
      message: message,
      responseTimeMs: responseTimeMs,
    );
  }
}
