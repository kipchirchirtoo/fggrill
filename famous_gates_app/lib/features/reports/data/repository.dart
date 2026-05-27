import 'dart:async';
import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/network/dio_client.dart';
import '../../../core/storage/secure_storage_provider.dart';
import '../../auth/data/auth_repository.dart';
import '../domain/models.dart';

final reportsRepositoryProvider = Provider<ReportsRepository>((ref) {
  return ReportsRepository(
      ref.read(dioProvider), ref.read(pythonDioProvider), ref);
});

class ReportsRepository {
  ReportsRepository(this._dio, this._pythonDio, this._ref);

  final Dio _pythonDio;

  final Dio _dio;
  final Ref _ref;

  Future<String> get _branchId async {
    final storage = _ref.read(secureStorageProvider);
    return await storage.read(key: AuthRepository.branchIdKey) ?? '';
  }

  Map<String, dynamic> _unwrap(dynamic data) {
    if (data is Map && data['success'] == true && data['data'] != null) {
      return Map<String, dynamic>.from(data['data']);
    }
    return Map<String, dynamic>.from(data ?? {});
  }

  List<T> _parseList<T>(
      dynamic data, T Function(Map<String, dynamic>) fromJson) {
    final list =
        data is List ? data : (data is Map ? (data['data'] ?? []) : []);
    return (list as List)
        .whereType<Map>()
        .map((json) => fromJson(Map<String, dynamic>.from(json)))
        .toList();
  }

  Future<List<ReportTemplate>> getReports() async {
    final response = await _dio.get('/reports');
    return _parseList(response.data, ReportTemplate.fromJson);
  }

  Future<ReportStats> getReportStats() async {
    final response = await _dio.get('/reports/stats/overview');
    return ReportStats.fromJson(_unwrap(response.data));
  }

  Future<ReportData> getReportData(String reportType,
      {Map<String, dynamic>? filters}) async {
    final branchId = await _branchId;
    final response = await _dio.get('/reports/data', queryParameters: {
      'type': reportType,
      if (branchId.isNotEmpty) 'branch_id': branchId,
      if (filters != null) ...filters,
    });
    return ReportData.fromJson(_unwrap(response.data));
  }

  Future<void> exportPdf(String reportType,
      {Map<String, dynamic>? filters}) async {
    final branchId = await _branchId;
    await _dio.post(
      '/reports/generate/async',
      data: {
        'reportType': reportType,
        'filters': {
          if (branchId.isNotEmpty) 'branch_id': branchId,
          if (filters != null) ...filters,
        },
        'useRealData': true,
      },
    );
  }

  Future<String> generateBrandedPdfAsync(String reportType,
      {Map<String, dynamic>? filters}) async {
    final branchId = await _branchId;
    final response = await _pythonDio.post(
      '/api/reports/generate/branded-pdf/async',
      data: {
        'reportType': reportType,
        'filters': {
          if (branchId.isNotEmpty) 'branch_id': branchId,
          if (filters != null) ...filters,
        },
        'useRealData': true,
      },
    );
    final data = response.data;
    final jobId = data is Map ? (data['jobId'] ?? data['job_id'] ?? '') : '';
    return '$jobId';
  }

  Future<Map<String, dynamic>> pollReportJob(String jobId) async {
    final response = await _pythonDio.get('/api/reports/jobs/$jobId');
    final data = response.data;
    return data is Map ? Map<String, dynamic>.from(data) : {};
  }

  Future<String?> generateBrandedPdfAndWait(String reportType,
      {Map<String, dynamic>? filters, int maxAttempts = 30}) async {
    final jobId = await generateBrandedPdfAsync(reportType, filters: filters);
    if (jobId.isEmpty) return null;
    for (var i = 0; i < maxAttempts; i++) {
      await Future.delayed(const Duration(seconds: 2));
      final status = await pollReportJob(jobId);
      if (status['status'] == 'completed') {
        return status['result_url'] as String?;
      }
      if (status['status'] == 'failed') {
        throw Exception(status['error'] ?? 'Report generation failed');
      }
    }
    throw Exception('Report generation timed out');
  }
}
