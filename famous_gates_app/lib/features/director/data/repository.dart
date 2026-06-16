import 'dart:io';

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:path_provider/path_provider.dart';
import '../../../core/network/dio_client.dart';

final directorRepositoryProvider = Provider<DirectorRepository>((ref) {
  return DirectorRepository(ref.read(dioProvider));
});

class DirectorRepository {
  DirectorRepository(this._dio);
  final Dio _dio;

  Future<Map<String, dynamic>> getComprehensiveDashboard({
    DateTime? startDate,
    DateTime? endDate,
    String? branchId,
  }) async {
    final res =
        await _dio.get('/finance/director/comprehensive', queryParameters: {
      if (startDate != null) 'startDate': _date(startDate),
      if (endDate != null) 'endDate': _date(endDate),
      if (branchId != null && branchId.isNotEmpty) 'branchId': branchId,
    });
    final data = res.data;
    return data is Map<String, dynamic>
        ? data
        : (data is Map ? Map<String, dynamic>.from(data) : {});
  }

  Future<List<Map<String, dynamic>>> getBranches() => _getList(
        '/finance/branches',
      );

  Future<Map<String, dynamic>> getPaymentBreakdown({
    DateTime? startDate,
    DateTime? endDate,
    String? branchId,
  }) {
    return _getMap('/finance/director/payment-breakdown',
        queryParameters: _rangeQuery(startDate, endDate, branchId: branchId));
  }

  Future<Map<String, dynamic>> getBankingReconciliation({
    DateTime? startDate,
    DateTime? endDate,
    String? branchId,
  }) {
    return _getMap('/finance/director/banking-reconciliation',
        queryParameters: _rangeQuery(startDate, endDate, branchId: branchId));
  }

  Future<Map<String, dynamic>> getBanking({
    DateTime? startDate,
    DateTime? endDate,
    String? branchId,
  }) {
    return _getMap('/finance/director/banking',
        queryParameters: _rangeQuery(startDate, endDate, branchId: branchId));
  }

  Future<List<Map<String, dynamic>>> getPayments({
    DateTime? startDate,
    DateTime? endDate,
    String? branchId,
  }) {
    return _getList('/finance/director/payments',
        queryParameters: _rangeQuery(startDate, endDate, branchId: branchId));
  }

  Future<List<Map<String, dynamic>>> getDiscrepancies({
    String? status,
    String? severity,
    String? branchId,
  }) {
    return _getList('/finance/discrepancies', queryParameters: {
      if (status != null && status.isNotEmpty) 'status': status,
      if (severity != null && severity.isNotEmpty) 'severity': severity,
      if (branchId != null && branchId.isNotEmpty) 'branch_id': branchId,
    });
  }

  Future<Map<String, dynamic>> createDiscrepancyFlag(
      Map<String, dynamic> data) async {
    final res = await _dio.post('/finance/discrepancies', data: data);
    return _checkedMap(res.data);
  }

  Future<Map<String, dynamic>> respondToDiscrepancy(
      String id, String response) async {
    final res = await _dio.patch('/finance/discrepancies/$id/respond',
        data: {'accountant_response': response});
    return _checkedMap(res.data);
  }

  Future<Map<String, dynamic>> finalizeDiscrepancy(
      String id, String decision, String status) async {
    final res = await _dio.patch('/finance/discrepancies/$id/finalize',
        data: {'decision': decision, 'status': status});
    return _checkedMap(res.data);
  }

  Future<List<Map<String, dynamic>>> getTasks({
    String? status,
    String? priority,
    String? assignedToRole,
  }) {
    return _getList('/finance/director/tasks', queryParameters: {
      if (status != null && status.isNotEmpty) 'status': status,
      if (priority != null && priority.isNotEmpty) 'priority': priority,
      if (assignedToRole != null && assignedToRole.isNotEmpty)
        'assigned_to_role': assignedToRole,
    });
  }

  Future<Map<String, dynamic>> createTask(Map<String, dynamic> data) async {
    final res = await _dio.post('/finance/director/tasks', data: data);
    return _checkedMap(res.data);
  }

  Future<Map<String, dynamic>> respondToTask(
      String id, String responseNotes) async {
    final res = await _dio.patch('/finance/director/tasks/$id/respond',
        data: {'response_notes': responseNotes});
    return _checkedMap(res.data);
  }

  Future<Map<String, dynamic>> closeTask(
      String id, String status, String directorNotes) async {
    final res = await _dio.patch('/finance/director/tasks/$id/close',
        data: {'status': status, 'director_notes': directorNotes});
    return _checkedMap(res.data);
  }

  Future<Map<String, dynamic>> getDrillDownData({
    required String branchId,
    required DateTime date,
    required String stream,
  }) {
    return _getMap('/finance/director/drill-down', queryParameters: {
      'branch_id': branchId,
      'date': _date(date),
      'stream': stream,
    });
  }

  Future<File> exportDirectorPdf({
    DateTime? startDate,
    DateTime? endDate,
    String? reportType,
    String? branchId,
  }) async {
    return _download(
      '/finance/director/export-pdf',
      'Director_Report_${DateTime.now().millisecondsSinceEpoch}.pdf',
      queryParameters: {
        ..._rangeQuery(startDate, endDate, branchId: branchId),
        if (reportType != null && reportType.isNotEmpty)
          'reportType': reportType,
      },
    );
  }

  Future<File> exportDiscrepancyAudit({
    String? status,
    String? severity,
    String? branchId,
  }) async {
    return _download(
      '/finance/discrepancies/export',
      'Discrepancy_Audit_Report_${DateTime.now().millisecondsSinceEpoch}.pdf',
      queryParameters: {
        if (status != null && status.isNotEmpty) 'status': status,
        if (severity != null && severity.isNotEmpty) 'severity': severity,
        if (branchId != null && branchId.isNotEmpty) 'branch_id': branchId,
      },
    );
  }

  Future<List<Map<String, dynamic>>> _getList(
    String path, {
    Map<String, dynamic>? queryParameters,
  }) async {
    final res = await _dio.get(path, queryParameters: queryParameters);
    final data = res.data;
    final list = data is List
        ? data
        : (data is Map
            ? (data['data'] ?? data['items'] ?? data['rows'] ?? [])
            : []);
    return (list as List)
        .whereType<Map>()
        .map((e) => Map<String, dynamic>.from(e))
        .toList();
  }

  Future<Map<String, dynamic>> _getMap(
    String path, {
    Map<String, dynamic>? queryParameters,
  }) async {
    final res = await _dio.get(path, queryParameters: queryParameters);
    return _asMap(res.data);
  }

  Map<String, dynamic> _asMap(dynamic data) {
    return data is Map<String, dynamic>
        ? data
        : (data is Map ? Map<String, dynamic>.from(data) : {});
  }

  Map<String, dynamic> _checkedMap(dynamic data) {
    final map = _asMap(data);
    if (map['success'] == false) {
      throw Exception(
          map['message'] ?? 'Director request could not be completed');
    }
    return map;
  }

  Map<String, dynamic> _rangeQuery(
    DateTime? startDate,
    DateTime? endDate, {
    String? branchId,
  }) {
    return {
      if (startDate != null) 'startDate': _date(startDate),
      if (endDate != null) 'endDate': _date(endDate),
      if (branchId != null && branchId.isNotEmpty) 'branchId': branchId,
    };
  }

  Future<File> _download(
    String path,
    String filename, {
    Map<String, dynamic>? queryParameters,
  }) async {
    final res = await _dio.get<List<int>>(
      path,
      queryParameters: queryParameters,
      options: Options(responseType: ResponseType.bytes),
    );
    final directory = await getDownloadsDirectory() ??
        await getApplicationDocumentsDirectory();
    final safeName = filename.replaceAll(RegExp(r'[^A-Za-z0-9._-]'), '_');
    final file = File('${directory.path}/$safeName');
    await file.writeAsBytes(res.data ?? const []);
    return file;
  }

  String _date(DateTime d) =>
      '${d.year}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';

  // ── Branch Payroll Intelligence ───────────────────────────────────────────

  Future<Map<String, dynamic>> getPayrollDirectorSummary({int? month, int? year}) async {
    final now = DateTime.now();
    return _getMap('/finance/payroll/director-summary', queryParameters: {
      'period_month': month ?? now.month,
      'period_year': year ?? now.year,
    });
  }

  Future<List<Map<String, dynamic>>> getPayrollBatches({String? status}) async {
    return _getList('/finance/payroll/batches', queryParameters: {
      if (status != null) 'status': status,
    });
  }

  Future<void> approvePayrollBatch(String id, String action, {String? notes}) async {
    await _dio.patch('/finance/payroll/batches/$id/approve', data: {
      'action': action,
      if (notes != null && notes.isNotEmpty) 'notes': notes,
    });
  }

  // ── Financial Close Intelligence ──────────────────────────────────────────

  Future<Map<String, dynamic>> getBranchProfitability({String? from, String? to, String? branchId}) async {
    return _getMap('/finance/branch-profitability', queryParameters: {
      if (branchId != null) 'branch_id': branchId,
      if (from != null) 'from': from,
      if (to != null) 'to': to,
    });
  }

  Future<List<Map<String, dynamic>>> getWorkspaceSubmissions({String? status, String? branchId}) async {
    return _getList('/finance/workspace/submissions', queryParameters: {
      if (branchId != null) 'branch_id': branchId,
      if (status != null) 'status': status,
      'limit': '90',
    });
  }
}
