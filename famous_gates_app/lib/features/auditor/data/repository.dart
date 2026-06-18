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

  List<Map<String, dynamic>> _unwrapList(dynamic data) {
    List<dynamic>? list;
    if (data is List) {
      list = data;
    } else if (data is Map) {
      final inner = data['data'] ?? data['items'] ?? data['rows'];
      if (inner is List) list = inner;
    }
    return (list ?? [])
        .whereType<Map>()
        .map((e) => Map<String, dynamic>.from(e))
        .toList();
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
      final backend = await _getOptional(endpoint, {
        if (branchId.isNotEmpty) 'branch_id': branchId,
        ...queryParameters,
      }, branchId);
      if (_hasRows(backend)) return backend;
      return _getInvoiceVerification(
        branchId: branchId,
        queryParameters: queryParameters,
      );
    }
    if (endpoint == '/auditor/credit-bills' ||
        endpoint == '/credit/pending/auditor') {
      final backend = await _getOptional('/auditor/credit-bills', {
        if (branchId.isNotEmpty) 'branch_id': branchId,
        ...queryParameters,
      }, branchId);
      if (_hasRows(backend)) return backend;
      return _getCreditBillsForAudit(
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

  Future<Map<String, dynamic>> _getCreditBillsForAudit({
    required String branchId,
    Map<String, dynamic> queryParameters = const {},
  }) async {
    final params = <String, dynamic>{
      if (branchId.isNotEmpty) 'branch_id': branchId,
      ...queryParameters,
    };

    final responses = await Future.wait<dynamic>([
      _getOptional('/cashier/credit-bills', params, branchId),
      _getOptional('/payroll/credit-bills', params, branchId),
    ]);

    final guestBills = _listFromResponse(responses[0]).map((row) {
      return {
        ...row,
        '_source': 'guest_bills',
        'type': row['bill_type'] ?? 'customer_credit_bill',
        'customer_name':
            row['customer_name'] ?? row['guest_name'] ?? row['staff_name'],
        'employee_name': row['staff_name'] ?? row['employee_name'],
        'bill_number': row['bill_number'] ?? row['reference'] ?? row['id'],
        'amount': row['amount'] ?? row['total_amount'] ?? row['balance'],
        'total_amount': row['total_amount'] ?? row['amount'] ?? row['balance'],
        'status': row['auditor_status'] ??
            row['approval_status'] ??
            row['status'] ??
            row['payment_status'],
      };
    });

    final employeeBills = _listFromResponse(responses[1]).map((row) {
      final staff = row['staff'];
      final staffName = staff is Map
          ? [
              staff['first_name'],
              staff['last_name'],
            ]
              .where((part) => part != null && '$part'.trim().isNotEmpty)
              .join(' ')
          : null;
      return {
        ...row,
        '_source': 'employee_bills',
        'type': row['bill_type'] ?? 'employee_credit_bill',
        'employee_name': row['employee_name'] ?? row['staff_name'] ?? staffName,
        'customer_name': row['customer_name'],
        'bill_number': row['bill_number'] ?? row['reference'] ?? row['id'],
        'amount': row['amount'] ?? row['total_amount'] ?? row['balance'],
        'total_amount': row['total_amount'] ?? row['amount'] ?? row['balance'],
        'status': row['auditor_status'] ??
            row['approval_status'] ??
            row['status'] ??
            row['payment_status'],
      };
    });

    final rows = [...guestBills, ...employeeBills].toList();
    final pending = rows.where((row) {
      final status =
          '${row['status'] ?? row['auditor_status'] ?? ''}'.toLowerCase();
      return status.isEmpty ||
          status == 'pending' ||
          status == 'submitted' ||
          status == 'confirmed' ||
          status == 'accountant_verified';
    }).length;
    final totalValue = rows.fold<num>(0, (sum, row) {
      final value = row['total_amount'] ?? row['amount'] ?? row['balance'] ?? 0;
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
        },
        'employee_bills': employeeBills.toList(),
        'guest_bills': guestBills.toList(),
        'credit_bills': rows,
      },
    };
  }

  Future<dynamic> _getOptional(
    String endpoint,
    Map<String, dynamic> params,
    String branchId,
  ) async {
    try {
      final response = await _dio.get(endpoint,
          queryParameters: params, options: _branchOptions(branchId));
      return response.data;
    } on DioException catch (error) {
      final status = error.response?.statusCode;
      if (status == 400 || status == 403 || status == 404 || status == 500) {
        return {'success': true, 'data': <Map<String, dynamic>>[]};
      }
      rethrow;
    }
  }

  List<Map<String, dynamic>> _listFromResponse(dynamic responseData) {
    dynamic value = responseData;
    if (value is Map && value['success'] == true && value.containsKey('data')) {
      value = value['data'];
    }
    if (value is Map) {
      for (final key in [
        'records',
        'items',
        'rows',
        'data',
        'invoices',
        'bills',
        'credit_bills',
        'employee_bills',
        'guest_bills',
        'transactions',
        'payments',
        'logbooks',
      ]) {
        final list = value[key];
        if (list is List) {
          return list.whereType<Map>().map(Map<String, dynamic>.from).toList();
        }
      }
      for (final nested in ['payload', 'result', 'summary']) {
        final child = value[nested];
        if (child is Map) {
          final rows = _listFromResponse(child);
          if (rows.isNotEmpty) return rows;
        }
      }
    }
    if (value is List) {
      return value.whereType<Map>().map(Map<String, dynamic>.from).toList();
    }
    return <Map<String, dynamic>>[];
  }

  bool _hasRows(dynamic responseData) => _listFromResponse(responseData).isNotEmpty;

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
    final creditMatch = RegExp(r'^/credit/(employee|guest)/([^/]+)/confirm$')
        .firstMatch(endpoint);
    if (creditMatch != null) {
      final type = creditMatch.group(1)!;
      final id = creditMatch.group(2)!;
      final requestedStatus = '${data['status'] ?? 'approved'}'.toLowerCase();
      final notes = data['notes'];
      if (type == 'guest') {
        if (requestedStatus != 'approved') {
          await _dio.post('/auditor/watchlist', data: {
            'entity_type': 'credit_bill',
            'entity_id': id,
            'reason': notes ?? 'Credit bill marked for auditor review',
          });
          return {'success': true};
        }
        final response = await _dio.patch('/cashier/credit-bills/$id/confirm',
            data: {
              'role': 'auditor',
              if (notes != null) 'notes': notes,
            },
            queryParameters: queryParameters);
        return response.data;
      }
      final response = await _dio.patch('/payroll/credit-bills/$id',
          data: {
            'status': requestedStatus == 'approved'
                ? 'auditor_confirmed'
                : 'cancelled',
            if (notes != null) 'notes': notes,
          },
          queryParameters: queryParameters);
      return response.data;
    }

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

  // ── Financial Close Audit Queue ───────────────────────────────────────────

  Future<List<Map<String, dynamic>>> getWorkspaceAuditQueue() async {
    final res = await _dio.get('/finance/workspace/audit-queue');
    return _unwrapList(res.data);
  }

  Future<List<Map<String, dynamic>>> getWorkspaceSubmissions({String? status}) async {
    final branchId = await _branchId;
    final res = await _dio.get('/finance/workspace/submissions', queryParameters: {
      if (branchId.isNotEmpty) 'branch_id': branchId,
      if (status != null && status.isNotEmpty) 'status': status,
    });
    return _unwrapList(res.data);
  }

  Future<Map<String, dynamic>> getWorkspaceSubmission(String id) async {
    final res = await _dio.get('/finance/workspace/submissions/$id');
    return _unwrap(res.data);
  }

  Future<void> reviewWorkspaceSubmission(String id, String action, {String? notes}) async {
    await _dio.patch('/finance/workspace/submissions/$id/review', data: {
      'action': action,
      if (notes != null && notes.isNotEmpty) 'notes': notes,
    });
  }

  // ── Payroll Audit ─────────────────────────────────────────────────────────

  Future<List<Map<String, dynamic>>> getPayrollBatchesForReview() async {
    final res = await _dio.get('/finance/payroll/batches', queryParameters: {'status': 'auditor_review'});
    return _unwrapList(res.data);
  }

  Future<Map<String, dynamic>> getPayrollBatch(String id) async {
    final res = await _dio.get('/finance/payroll/batches/$id');
    return _unwrap(res.data) as Map<String, dynamic>? ?? {};
  }

  Future<void> reviewPayrollBatch(String id, String action, {String? notes}) async {
    await _dio.patch('/finance/payroll/batches/$id/review', data: {
      'action': action,
      if (notes != null && notes.isNotEmpty) 'notes': notes,
    });
  }

  Future<List<Map<String, dynamic>>> getCentralStoreInventory({
    String? category,
    String? search,
  }) async {
    final res = await _dio.get('/store/master-catalog', queryParameters: {
      if (category != null && category != 'all') 'category': category,
      if (search != null && search.isNotEmpty) 'search': search,
    });
    return _unwrapList(res.data);
  }
}
