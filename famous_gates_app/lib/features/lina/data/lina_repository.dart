import 'dart:async';
import 'dart:convert';
import 'package:dio/dio.dart';
import '../../../core/utils/api_error_message.dart';

class LinaRepository {
  final Dio _dio;
  LinaRepository(this._dio);

  Future<Map<String, dynamic>> getContext() async {
    final r = await _get('/lina/context');
    return Map<String, dynamic>.from(r.data['data'] ?? r.data);
  }

  Future<Map<String, dynamic>> getMonitoring() async {
    final r = await _get('/lina/monitoring');
    return Map<String, dynamic>.from(r.data['data'] ?? r.data);
  }

  Future<Map<String, dynamic>> getModelRouter() async {
    final r = await _get('/lina/model-router');
    return Map<String, dynamic>.from(r.data['data'] ?? r.data);
  }

  Future<Map<String, dynamic>> getExecutiveSummary() async {
    final r = await _get('/lina/executive-summary');
    return Map<String, dynamic>.from(r.data['data'] ?? r.data);
  }

  Future<Map<String, dynamic>> getAnomalyReport() async {
    final r = await _get('/lina/anomaly-report');
    return Map<String, dynamic>.from(r.data['data'] ?? r.data);
  }

  Future<Map<String, dynamic>> getIncidentTimeline() async {
    final r = await _get('/lina/incident-timeline');
    return Map<String, dynamic>.from(r.data['data'] ?? r.data);
  }

  Future<Map<String, dynamic>> getEmployeeIntelligence() async {
    final r = await _get('/lina/employee-intelligence');
    return Map<String, dynamic>.from(r.data['data'] ?? r.data);
  }

  Future<Map<String, dynamic>> getFinancialIntelligence() async {
    final r = await _get('/lina/financial-intelligence');
    return Map<String, dynamic>.from(r.data['data'] ?? r.data);
  }

  Future<List<Map<String, dynamic>>> getRecommendations() async {
    final r = await _get('/lina/recommendations');
    final recs = r.data['data']?['recommendations'];
    if (recs is List) {
      return recs.map((e) => Map<String, dynamic>.from(e as Map)).toList();
    }
    return [];
  }

  Future<List<Map<String, dynamic>>> getBranchBenchmark() async {
    final r = await _get('/lina/branch-benchmark');
    final cards = r.data['data']?['scorecards'];
    if (cards is List) {
      return cards.map((e) => Map<String, dynamic>.from(e as Map)).toList();
    }
    return [];
  }

  Future<Map<String, dynamic>> getForecast() async {
    final r = await _get('/lina/forecast');
    return Map<String, dynamic>.from(r.data['data'] ?? r.data);
  }

  Future<List<Map<String, dynamic>>> getPendingRemediations() async {
    final r = await _get('/lina/remediations/pending');
    final data = r.data['data'];
    if (data is List) {
      return data.map((e) => Map<String, dynamic>.from(e as Map)).toList();
    }
    return [];
  }

  Future<List<Map<String, dynamic>>> getRemediationHistory() async {
    final r = await _get('/lina/remediations/history');
    final data = r.data['data'];
    if (data is List) {
      return data.map((e) => Map<String, dynamic>.from(e as Map)).toList();
    }
    return [];
  }

  Future<Map<String, dynamic>> getRemediationDetail(String id) async {
    final r = await _get('/lina/remediations/$id/history');
    return Map<String, dynamic>.from(r.data['data'] ?? r.data);
  }

  Future<List<Map<String, dynamic>>> getAgentLogs() async {
    final r = await _get('/lina/agent-logs');
    final data = r.data['data'];
    if (data is List) {
      return data.map((e) => Map<String, dynamic>.from(e as Map)).toList();
    }
    return [];
  }

  Future<void> approveRemediation(String id) async {
    await _post('/lina/remediations/$id/approve');
  }

  Future<void> rejectRemediation(String id) async {
    await _post('/lina/remediations/$id/reject');
  }

  Future<Map<String, dynamic>> createRemediation(
      Map<String, dynamic> body) async {
    final r = await _post('/lina/remediate', data: body);
    return Map<String, dynamic>.from(r.data['data'] ?? r.data);
  }

  Future<Map<String, dynamic>> executeRemediation(String id) async {
    final r = await _post('/lina/remediations/$id/execute');
    return Map<String, dynamic>.from(r.data['data'] ?? r.data);
  }

  Future<Map<String, dynamic>> verifyRemediation(String id) async {
    final r = await _post('/lina/remediations/$id/verify');
    return Map<String, dynamic>.from(r.data['data'] ?? r.data);
  }

  Stream<String> chatStream(
      String message, List<Map<String, String>> history) async* {
    late final Response<ResponseBody> response;
    try {
      response = await _dio.post<ResponseBody>(
        '/lina/chat',
        data: {'message': message, 'history': history},
        options: Options(responseType: ResponseType.stream),
      );
    } on DioException catch (e) {
      throw apiErrorMessage(e, fallback: 'Lina request failed');
    }

    final stream = response.data!.stream;
    final buf = StringBuffer();

    await for (final chunk in stream) {
      buf.write(utf8.decode(chunk));
      final raw = buf.toString();
      final parts = raw.split('\n');
      buf.clear();
      if (!raw.endsWith('\n')) buf.write(parts.removeLast());
      for (final line in parts) {
        if (!line.startsWith('data: ')) continue;
        final payload = line.substring(6).trim();
        if (payload.isEmpty || payload == '[DONE]') continue;
        try {
          final j = jsonDecode(payload) as Map<String, dynamic>;
          if (j['type'] == 'delta' && j['text'] is String) {
            yield j['text'] as String;
          }
        } catch (_) {}
      }
    }
  }

  Future<Response<dynamic>> _get(String path) async {
    try {
      return await _dio.get(path);
    } on DioException catch (e) {
      throw apiErrorMessage(e, fallback: 'Lina request failed');
    }
  }

  Future<Response<dynamic>> _post(String path, {dynamic data}) async {
    try {
      return await _dio.post(path, data: data);
    } on DioException catch (e) {
      throw apiErrorMessage(e, fallback: 'Lina request failed');
    }
  }
}
