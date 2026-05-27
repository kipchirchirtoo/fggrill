import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:path_provider/path_provider.dart';
import 'dart:io';

import '../../../core/network/dio_client.dart';
import '../../../core/storage/secure_storage_provider.dart';
import '../../auth/data/auth_repository.dart';

final branchAccountantRepositoryProvider =
    Provider<BranchAccountantRepository>((ref) {
  return BranchAccountantRepository(ref.watch(dioProvider), ref);
});

class BranchAccountantRepository {
  BranchAccountantRepository(this._dio, this._ref);

  final Dio _dio;
  final Ref _ref;

  Future<String> getBranchId() async {
    final storage = _ref.read(secureStorageProvider);
    return await storage.read(key: AuthRepository.branchIdKey) ?? '';
  }

  Future<Map<String, dynamic>> getCashierClearances({
    String? date,
    String? status,
  }) async {
    final branchId = await getBranchId();
    return _getMap('/cashier/clearances', query: {
      if (branchId.isNotEmpty) 'branch_id': branchId,
      if (date != null && date.isNotEmpty) 'date': date,
      if (status != null && status != 'all') 'status': status,
    });
  }

  Future<void> approveClearance(String id, {String? notes}) async {
    await _dio.post('/cashier/clearances/$id/approve', data: {
      if (notes != null && notes.trim().isNotEmpty) 'notes': notes.trim(),
    });
  }

  Future<void> flagClearance(
    String id, {
    required String reason,
    String? notes,
  }) async {
    await _dio.post('/cashier/clearances/$id/flag', data: {
      'reason': reason,
      if (notes != null && notes.trim().isNotEmpty) 'notes': notes.trim(),
    });
  }

  Future<Map<String, dynamic>> getBranchSalesAnalytics({
    required String startDate,
    required String endDate,
    Map<String, dynamic> filters = const {},
  }) async {
    final branchId = await getBranchId();
    final res = await _dio.post('/analytics/branch-sales', data: {
      if (branchId.isNotEmpty) 'branch_id': int.tryParse(branchId) ?? branchId,
      'start_date': startDate,
      'end_date': endDate,
      'filters': filters,
    });
    return _asMap(res.data);
  }

  Future<File> exportBranchSales({
    required String startDate,
    required String endDate,
    required String format,
    Map<String, dynamic> filters = const {},
  }) async {
    final branchId = await getBranchId();
    final res = await _dio.post<List<int>>(
      '/analytics/branch-sales/export/$format',
      data: {
        if (branchId.isNotEmpty)
          'branch_id': int.tryParse(branchId) ?? branchId,
        'start_date': startDate,
        'end_date': endDate,
        'filters': filters,
      },
      options: Options(responseType: ResponseType.bytes),
    );
    return _saveBytes(
      res.data ?? const [],
      'branch-sales-$startDate-$endDate.$format',
    );
  }

  Future<Map<String, dynamic>> getBranchFinancials({
    required String startDate,
    required String endDate,
  }) async {
    final branchId = await getBranchId();
    if (branchId.isEmpty) return {};
    return _getMap('/finance/branch-financials/$branchId', query: {
      'startDate': startDate,
      'endDate': endDate,
    });
  }

  Future<List<Map<String, dynamic>>> getDailyRecords({
    required String startDate,
    required String endDate,
  }) async {
    final branchId = await getBranchId();
    return _getList('/finance/workspace/daily', query: {
      if (branchId.isNotEmpty) 'branch_id': branchId,
      'start_date': startDate,
      'end_date': endDate,
    });
  }

  Future<Map<String, dynamic>> getDailyRecordByDate(String date) async {
    final branchId = await getBranchId();
    return _getMap('/finance/workspace/daily/$date', query: {
      if (branchId.isNotEmpty) 'branch_id': branchId,
    });
  }

  Future<void> saveDailyRecord(Map<String, dynamic> data) async {
    final branchId = await getBranchId();
    await _dio.post('/finance/workspace/daily', data: {
      if (branchId.isNotEmpty) 'branch_id': int.tryParse(branchId) ?? branchId,
      ...data,
    });
  }

  Future<List<Map<String, dynamic>>> getMonthlyAdjustments({
    required int year,
    required int month,
  }) async {
    final branchId = await getBranchId();
    return _getList('/finance/workspace/monthly', query: {
      if (branchId.isNotEmpty) 'branch_id': branchId,
      'fiscal_year': year,
      'fiscal_month': month,
    });
  }

  Future<void> saveMonthlyAdjustment(Map<String, dynamic> data) async {
    final branchId = await getBranchId();
    await _dio.post('/finance/workspace/monthly', data: {
      if (branchId.isNotEmpty) 'branch_id': int.tryParse(branchId) ?? branchId,
      ...data,
    });
  }

  Future<File> exportMonthlyStatement({
    required int year,
    required int month,
  }) async {
    final branchId = await getBranchId();
    final res = await _dio.get<List<int>>(
      '/finance/workspace/export',
      queryParameters: {
        if (branchId.isNotEmpty) 'branch_id': branchId,
        'fiscal_year': year,
        'fiscal_month': month,
      },
      options: Options(responseType: ResponseType.bytes),
    );
    final monthText = month.toString().padLeft(2, '0');
    return _saveBytes(
      res.data ?? const [],
      'Financial_Statement_${year}_$monthText.pdf',
    );
  }

  Future<List<Map<String, dynamic>>> getDirectorTasks() {
    return _getList('/finance/director/tasks', query: {
      'status': 'PENDING',
      'assigned_to_role': 'branch_accountant',
    });
  }

  Future<void> respondDirectorTask(String id, String notes) async {
    await _dio.patch('/finance/director/tasks/$id/respond', data: {
      'response_notes': notes,
    });
  }

  Future<List<Map<String, dynamic>>> getDiscrepancies() async {
    final branchId = await getBranchId();
    return _getList('/finance/discrepancies', query: {
      if (branchId.isNotEmpty) 'branch_id': branchId,
    });
  }

  Future<void> respondDiscrepancy(String id, String response) async {
    await _dio.patch('/finance/discrepancies/$id/respond', data: {
      'accountant_response': response,
    });
  }

  Future<Map<String, dynamic>> getProfitLoss({
    required String fromDate,
    required String toDate,
  }) async {
    final branchId = await getBranchId();
    return _getMap('/finance/profit-loss', query: {
      if (branchId.isNotEmpty) 'branch_id': branchId,
      'from_date': fromDate,
      'to_date': toDate,
    });
  }

  Future<Map<String, dynamic>> getRevenueOversight(
      {required int period}) async {
    final branchId = await getBranchId();
    return _getMap('/finance/revenue-oversight', query: {
      if (branchId.isNotEmpty) 'branch_id': branchId,
      'period': period,
    });
  }

  Future<Map<String, dynamic>> getSoldItems({
    required String startDate,
    required String endDate,
  }) async {
    final branchId = await getBranchId();
    return _getMap('/auditor/verify/sold-items', query: {
      if (branchId.isNotEmpty) 'branch_id': branchId,
      'start_date': startDate,
      'end_date': endDate,
    });
  }

  Future<Map<String, dynamic>> getStaffAudit({
    required String startDate,
    required String endDate,
    String? staffId,
  }) async {
    final branchId = await getBranchId();
    return _getMap('/auditor/staff-audit', query: {
      if (branchId.isNotEmpty) 'branch_id': branchId,
      'start_date': startDate,
      'end_date': endDate,
      if (staffId != null && staffId != 'all') 'staff_id': staffId,
    });
  }

  Future<List<Map<String, dynamic>>> getBudgets() async {
    final branchId = await getBranchId();
    return _getList('/branch-operations/finances/budgets', query: {
      if (branchId.isNotEmpty) 'branch_id': branchId,
    });
  }

  Future<Map<String, dynamic>> getBudgetSummary() async {
    final branchId = await getBranchId();
    return _getMap('/branch-operations/finances/budget-summary', query: {
      if (branchId.isNotEmpty) 'branch_id': branchId,
    });
  }

  Future<Map<String, dynamic>> getBudgetAnalysis() async {
    final branchId = await getBranchId();
    return _getMap('/branch-operations/finances/budget-analysis', query: {
      if (branchId.isNotEmpty) 'branch_id': branchId,
    });
  }

  Future<void> createBudget(Map<String, dynamic> data) async {
    await _dio.post('/branch-operations/finances/budgets', data: data);
  }

  Future<void> updateBudget(String id, Map<String, dynamic> data) async {
    await _dio.put('/branch-operations/finances/budgets/$id', data: data);
  }

  Future<void> deleteBudget(String id) async {
    await _dio.delete('/branch-operations/finances/budgets/$id');
  }

  Future<void> linkBudgetExpense(String id, Map<String, dynamic> data) async {
    await _dio.post('/branch-operations/finances/budgets/$id/expenses',
        data: data);
  }

  Future<Map<String, dynamic>> _getMap(
    String path, {
    Map<String, dynamic>? query,
  }) async {
    final res = await _dio.get(path, queryParameters: query);
    return _asMap(res.data);
  }

  Future<List<Map<String, dynamic>>> _getList(
    String path, {
    Map<String, dynamic>? query,
  }) async {
    final res = await _dio.get(path, queryParameters: query);
    return _asList(res.data);
  }

  Map<String, dynamic> _asMap(dynamic value) {
    if (value is Map<String, dynamic>) {
      if (value['data'] is Map) {
        final data = Map<String, dynamic>.from(value['data'] as Map);
        if (value['summary'] != null) data['summary'] = value['summary'];
        if (value['meta'] != null) data['meta'] = value['meta'];
        return data;
      }
      return value;
    }
    if (value is Map) return Map<String, dynamic>.from(value);
    return {};
  }

  List<Map<String, dynamic>> _asList(dynamic value) {
    final data = value is Map
        ? value['data'] ??
            value['items'] ??
            value['records'] ??
            value['analysis'] ??
            []
        : value;
    if (data is List) {
      return data
          .whereType<Map>()
          .map((item) => Map<String, dynamic>.from(item))
          .toList();
    }
    return [];
  }

  Future<File> _saveBytes(List<int> bytes, String filename) async {
    final directory = await getDownloadsDirectory() ??
        await getApplicationDocumentsDirectory();
    final safeName = filename.replaceAll(RegExp(r'[^A-Za-z0-9._-]'), '_');
    final file = File('${directory.path}/$safeName');
    await file.writeAsBytes(bytes, flush: true);
    return file;
  }
}
