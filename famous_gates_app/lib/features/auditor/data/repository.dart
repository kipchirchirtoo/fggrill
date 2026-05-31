import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:path_provider/path_provider.dart';
import 'dart:io';
import '../../../core/network/dio_client.dart';
import '../../admin/domain/admin_providers.dart';
import '../domain/models.dart';

final auditorRepositoryProvider = Provider<AuditorRepository>((ref) {
  return AuditorRepository(ref.read(dioProvider), ref);
});

class AuditorRepository {
  AuditorRepository(this._dio, this._ref);

  final Dio _dio;
  final Ref _ref;

  Future<String> get _branchId async {
    final selectedBranchId = _ref.read(adminSelectedBranchProvider);
    if (selectedBranchId != null && selectedBranchId.trim().isNotEmpty) {
      return selectedBranchId.trim();
    }
    return '';
  }

  Future<String> getCurrentBranchId() => _branchId;

  Map<String, dynamic> _unwrap(dynamic data) {
    if (data is Map && data['success'] == true && data['data'] != null) {
      final inner = data['data'];
      if (inner is Map) return Map<String, dynamic>.from(inner);
      return {'items': inner};
    }
    if (data is Map) return Map<String, dynamic>.from(data);
    return {'items': data};
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

  Future<AuditOverview> getAuditOverview() async {
    final branchId = await _branchId;
    final response =
        await _dio.get('/payments-verification/stats', queryParameters: {
      if (branchId.isNotEmpty) 'branch_id': branchId,
    });
    return AuditOverview.fromJson(_unwrap(response.data));
  }

  Future<List<AuditLogEntry>> getAuditLogs(
      {String? severity, int limit = 20}) async {
    final branchId = await _branchId;
    final response = await _dio.get('/audit/logs', queryParameters: {
      if (branchId.isNotEmpty) 'branch_id': branchId,
      if (severity != null) 'severity': severity,
      'limit': limit,
    });
    return _parseList(response.data, AuditLogEntry.fromJson);
  }

  Future<List<Discrepancy>> getDiscrepancies({String? status}) async {
    final branchId = await _branchId;
    try {
      final response = await _dio.get('/auditor/exceptions', queryParameters: {
        if (branchId.isNotEmpty) 'branch_id': branchId,
        if (status != null) 'status': status,
      });
      return _parseList(response.data, Discrepancy.fromJson);
    } catch (_) {
      return [];
    }
  }

  Future<void> clearAnomaly(String id, String notes) async {
    await _dio.post('/auditor/anomalies/$id/clear',
        data: {'type': 'exception', 'notes': notes});
  }

  Future<void> flagItem(String type, String id, String reason) async {
    await _dio.post('/auditor/watchlist',
        data: {'entity_type': type, 'entity_id': id, 'reason': reason});
  }

  Future<List<Map<String, dynamic>>> getCashierClearances(
      {String? startDate, String? endDate, String? status}) async {
    final branchId = await _branchId;
    final res = await _dio.get('/auditor/verify/finances', queryParameters: {
      if (branchId.isNotEmpty) 'branch_id': branchId,
      if (startDate != null) 'date': startDate,
      if (status != null) 'status': status,
    });
    final data = _unwrap(res.data);
    final list = data['cashier_summaries'] ??
        data['recent_transactions'] ??
        data['branch_summaries'] ??
        data['items'] ??
        [];
    return (list as List)
        .whereType<Map>()
        .map((e) => Map<String, dynamic>.from(e))
        .toList();
  }

  Future<List<Map<String, dynamic>>> getReconciliation(
      {String? startDate, String? endDate}) async {
    final branchId = await _branchId;
    final res = await _dio.get('/auditor/verify/finances', queryParameters: {
      if (branchId.isNotEmpty) 'branch_id': branchId,
      if (startDate != null) 'date': startDate,
    });
    final data = _unwrap(res.data);
    final list =
        data['branch_summaries'] ?? data['cashier_summaries'] ?? const [];
    return (list as List)
        .whereType<Map>()
        .map((e) => Map<String, dynamic>.from(e))
        .toList();
  }

  Future<void> exportAuditReport(String reportType) async {
    final date = DateTime.now().toIso8601String().split('T').first;
    await downloadReport(
      '/reports/auditor/export/$reportType',
      '${reportType}_$date.xlsx',
    );
  }

  Future<dynamic> getRaw(
    String endpoint, {
    Map<String, dynamic> queryParameters = const {},
  }) async {
    final branchId = await _branchId;
    if (endpoint == '/auditor/invoice-verification') {
      return _getInvoiceVerification(
        branchId: branchId,
        queryParameters: queryParameters,
      );
    }
    try {
      final response = await _dio.get(endpoint,
          queryParameters: {
            if (branchId.isNotEmpty) 'branch_id': branchId,
            ..._defaultQuery(endpoint),
            ...queryParameters,
          },
          options: _branchOptions(branchId));
      return response.data;
    } on DioException catch (error) {
      final status = error.response?.statusCode;
      final message = '${error.response?.data}'.toLowerCase();
      if (status == 400 ||
          status == 403 ||
          status == 404 ||
          (status == 500 &&
              (message.contains('nan') || message.contains('null')))) {
        return {
          'success': true,
          'data': <Map<String, dynamic>>[],
          'message': 'No records are available for this audit view.',
        };
      }
      rethrow;
    }
  }

  Future<Map<String, dynamic>> _getInvoiceVerification({
    required String branchId,
    Map<String, dynamic> queryParameters = const {},
  }) async {
    final params = <String, dynamic>{
      if (branchId.isNotEmpty) 'branch_id': branchId,
      ...queryParameters,
    };
    final responses = await Future.wait([
      _dio.get('/accounting/invoices',
          queryParameters: params, options: _branchOptions(branchId)),
      _dio.get('/accounting/bills',
          queryParameters: params, options: _branchOptions(branchId)),
    ]);
    final invoiceRows = _listFromResponse(responses[0].data).map((row) {
      final customer = row['customer'];
      final customerName = customer is Map
          ? (customer['customer_name'] ??
              customer['name'] ??
              customer['company_name'])
          : null;
      return {
        ...row,
        '_source': 'invoices',
        'type': 'invoice',
        'supplier_name': row['customer_name'] ?? customerName ?? 'Customer',
        'counterparty_name': row['customer_name'] ?? customerName ?? 'Customer',
        'invoice_number': row['invoice_number'] ?? row['number'] ?? row['id'],
        'total_amount': row['total_amount'] ?? row['amount'] ?? row['total'],
      };
    });
    final billRows = _listFromResponse(responses[1].data).map((row) {
      final vendor = row['vendor'];
      final vendorName = vendor is Map
          ? (vendor['vendor_name'] ?? vendor['supplier_name'] ?? vendor['name'])
          : null;
      return {
        ...row,
        '_source': 'bills',
        'type': 'bill',
        'supplier_name': row['vendor_name'] ?? vendorName ?? 'Supplier',
        'counterparty_name': row['vendor_name'] ?? vendorName ?? 'Supplier',
        'invoice_number':
            row['bill_number'] ?? row['invoice_number'] ?? row['number'],
        'total_amount': row['total_amount'] ?? row['amount'] ?? row['total'],
      };
    });
    final rows = [...invoiceRows, ...billRows].toList();
    final pending = rows.where((row) {
      final status =
          '${row['status'] ?? row['audit_status'] ?? ''}'.toLowerCase().trim();
      return status.isEmpty ||
          status == 'draft' ||
          status == 'pending' ||
          status == 'submitted' ||
          status == 'pending_audit';
    }).length;
    final totalValue = rows.fold<num>(0, (sum, row) {
      final value = row['total_amount'] ?? row['amount'] ?? row['total'] ?? 0;
      return sum + (value is num ? value : num.tryParse('$value') ?? 0);
    });
    return {
      'success': true,
      'count': rows.length,
      'data': {
        'summary': {
          'records': rows.length,
          'pending_review': pending,
          'total_value': totalValue,
          'variance': 0,
        },
        'records': rows,
      },
    };
  }

  List<Map<String, dynamic>> _listFromResponse(dynamic responseData) {
    dynamic value = responseData;
    if (value is Map && value['success'] == true && value.containsKey('data')) {
      value = value['data'];
    }
    if (value is Map) {
      for (final key in ['records', 'items', 'rows', 'data', 'invoices']) {
        final list = value[key];
        if (list is List) {
          return list.whereType<Map>().map(Map<String, dynamic>.from).toList();
        }
      }
    }
    if (value is List) {
      return value.whereType<Map>().map(Map<String, dynamic>.from).toList();
    }
    return <Map<String, dynamic>>[];
  }

  Options? _branchOptions(String branchId) {
    if (branchId.isEmpty) return null;
    return Options(headers: {'x-branch-id': branchId});
  }

  Future<dynamic> submitAction(
    String method,
    String endpoint, {
    Map<String, dynamic> data = const {},
    Map<String, dynamic> queryParameters = const {},
  }) async {
    final response = switch (method.toUpperCase()) {
      'GET' => await _dio.get(endpoint,
          queryParameters: queryParameters,
          options: Options(responseType: ResponseType.bytes)),
      'PUT' =>
        await _dio.put(endpoint, data: data, queryParameters: queryParameters),
      'PATCH' => await _dio.patch(endpoint,
          data: data, queryParameters: queryParameters),
      'DELETE' => await _dio.delete(endpoint,
          data: data, queryParameters: queryParameters),
      _ =>
        await _dio.post(endpoint, data: data, queryParameters: queryParameters),
    };
    return response.data;
  }

  Future<File> downloadReport(String endpoint, String filename,
      {Map<String, dynamic> queryParameters = const {}}) async {
    final branchId = await _branchId;
    final response = await _dio.get<List<int>>(
      endpoint,
      queryParameters: {
        if (branchId.isNotEmpty) 'branch_id': branchId,
        ...queryParameters,
      },
      options: Options(
        responseType: ResponseType.bytes,
        receiveTimeout: const Duration(minutes: 5),
      ),
    );
    final directory = await getDownloadsDirectory() ??
        await getApplicationDocumentsDirectory();
    final safeName = filename.replaceAll(RegExp(r'[^A-Za-z0-9._-]'), '_');
    final file = File('${directory.path}/$safeName');
    await file.writeAsBytes(response.data ?? const <int>[], flush: true);
    return file;
  }

  Map<String, dynamic> _defaultQuery(String endpoint) {
    if (endpoint != '/auditor/consumption/variances') return const {};
    final now = DateTime.now();
    final from = now.subtract(const Duration(days: 30));
    String date(DateTime value) => value.toIso8601String().split('T').first;
    return {
      'from_date': date(from),
      'to_date': date(now),
    };
  }

  // ── Branch-orders / Stock-requests ───────────────────────────────────────

  Future<BranchOrdersData> getBranchOrders({
    String? startDate,
    String? endDate,
  }) async {
    final branchId = await _branchId;
    final response =
        await _dio.get('/auditor/verify/branch-orders', queryParameters: {
      if (branchId.isNotEmpty) 'branch_id': branchId,
      if (startDate != null) 'start_date': startDate,
      if (endDate != null) 'end_date': endDate,
    });
    final data = _unwrap(response.data);
    return BranchOrdersData.fromJson(data);
  }

  /// Review a single stock request.
  /// [action] must be 'APPROVE', 'REJECT', or left null for UNDER_REVIEW.
  Future<void> reviewStockRequest(
    String id,
    String action, {
    String? notes,
  }) async {
    await _dio.put('/storekeeping/stock-requests/$id/review', data: {
      'action': action,
      if (notes != null && notes.isNotEmpty) 'review_notes': notes,
    });
  }

  /// Approve multiple requests at once (auditor bulk action).
  Future<void> bulkApproveStockRequests(
    List<String> requestIds, {
    String? notes,
  }) async {
    await _dio.post('/storekeeping/stock-requests/bulk-approve', data: {
      'request_ids': requestIds,
      'approved_quantity_notes': notes ?? 'Bulk approved by auditor',
    });
  }

  Future<List<AuditLogEntry>> getAuditLogsPaged(
      {String? severity, String? action, int page = 1, int limit = 50}) async {
    final branchId = await _branchId;
    final response = await _dio.get('/audit/logs', queryParameters: {
      if (branchId.isNotEmpty) 'branch_id': branchId,
      if (severity != null) 'severity': severity,
      if (action != null) 'action': action,
      'page': page,
      'limit': limit,
    });
    return _parseList(response.data, AuditLogEntry.fromJson);
  }
}
