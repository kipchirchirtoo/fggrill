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

  Future<List<Map<String, dynamic>>> getShiftLogs(
      {String status = 'closed'}) async {
    final branchId = await getBranchId();
    return _getList('/cashier/shifts', query: {
      if (branchId.isNotEmpty) 'branch_id': branchId,
      if (status != 'all') 'status': status,
      'page': 1,
      'limit': 100,
    });
  }

  Future<Map<String, dynamic>> getShiftLog(String id) {
    return _getMap('/cashier/shifts/$id');
  }

  Future<void> reconcileShift(String id, String notes) async {
    await _dio.put('/cashier/shifts/$id/reconcile', data: {
      'reconciliation_notes': notes,
    });
  }

  Future<void> approveShiftOpening(String id, {String? notes}) async {
    await _dio.put('/cashier/shifts/$id/approve-open', data: {
      if (notes != null && notes.trim().isNotEmpty) 'notes': notes.trim(),
    });
  }

  Future<void> rejectShiftOpening(String id, {String? notes}) async {
    await _dio.put('/cashier/shifts/$id/reject-open', data: {
      if (notes != null && notes.trim().isNotEmpty) 'notes': notes.trim(),
    });
  }

  Future<List<Map<String, dynamic>>> getPendingCashierLogbooks() async {
    final branchId = await getBranchId();
    return _getList('/cashier/logbook/pending', query: {
      if (branchId.isNotEmpty) 'branch_id': branchId,
    });
  }

  Future<Map<String, dynamic>> getCashierLogbookDetail(String id) {
    return _getMap('/cashier/logbook/$id');
  }

  Future<File> downloadCashierLogbookReport(String id) async {
    final res = await _dio.get<List<int>>(
      '/cashier/logbook/$id/pdf',
      options: Options(responseType: ResponseType.bytes),
    );
    return _saveBytes(res.data ?? const [], 'Cashier_Logbook_$id.pdf');
  }

  Future<void> auditCashierLogbook(
    String id, {
    required bool approve,
    String notes = '',
  }) async {
    await _dio.post('/cashier/logbook/$id/audit', data: {
      'action': approve ? 'approve' : 'reject',
      if (notes.trim().isNotEmpty) 'notes': notes.trim(),
    });
  }

  Future<List<Map<String, dynamic>>> getPendingPosVoidRequests() async {
    final branchId = await getBranchId();
    return _getList('/pos/void-requests/pending', query: {
      if (branchId.isNotEmpty) 'branch_id': branchId,
    });
  }

  Future<void> reviewPosVoidRequest(
    String id, {
    required bool approve,
    String reason = '',
  }) async {
    await _dio.post('/pos/void-requests/$id/review', data: {
      'approved': approve,
      if (reason.trim().isNotEmpty) 'rejection_reason': reason.trim(),
      'action': approve ? 'approve' : 'reject',
    });
  }

  Future<Map<String, dynamic>> getBankingSummary() async {
    final branchId = await getBranchId();
    return _getMap('/banking/summary', query: {
      if (branchId.isNotEmpty) 'branch_id': branchId,
    });
  }

  Future<List<Map<String, dynamic>>> getBankingTransactions({
    String status = 'all',
  }) async {
    final branchId = await getBranchId();
    return _getList('/banking/transactions', query: {
      if (branchId.isNotEmpty) 'branch_id': branchId,
      if (status != 'all') 'status': status,
    });
  }

  Future<List<Map<String, dynamic>>> getBankAccounts() async {
    final branchId = await getBranchId();
    return _getList('/banking/accounts', query: {
      if (branchId.isNotEmpty) 'branch_id': branchId,
    });
  }

  Future<List<Map<String, dynamic>>> getBankReconciliations() async {
    final branchId = await getBranchId();
    return _getList('/banking/reconciliations', query: {
      if (branchId.isNotEmpty) 'branch_id': branchId,
    });
  }

  Future<void> recordBankingTransaction(Map<String, dynamic> data) async {
    final branchId = await getBranchId();
    await _dio.post('/banking/transactions', data: {
      if (branchId.isNotEmpty) 'branch_id': int.tryParse(branchId) ?? branchId,
      ...data,
    });
  }

  Future<void> approveBankingTransaction(
    String id, {
    required bool approve,
    String notes = '',
  }) async {
    await _dio.put('/banking/transactions/$id/approve', data: {
      'action': approve ? 'approve' : 'reject',
      if (notes.trim().isNotEmpty) 'notes': notes.trim(),
    });
  }

  Future<List<Map<String, dynamic>>> getCreditBills({
    String status = 'all',
  }) async {
    final branchId = await getBranchId();
    return _getList('/cashier/credit-bills', query: {
      if (branchId.isNotEmpty) 'branch_id': branchId,
      if (status != 'all') 'status': status,
    });
  }

  Future<void> confirmCreditBill(String id, String notes) async {
    await _dio.patch('/cashier/credit-bills/$id/confirm', data: {
      if (notes.trim().isNotEmpty) 'notes': notes.trim(),
    });
  }

  Future<void> recordCreditBillPayment(
    String id,
    Map<String, dynamic> data,
  ) async {
    await _dio.post('/cashier/credit-bills/$id/payment', data: data);
  }

  /// Schedule a staff credit bill to be deducted from the employee's payroll.
  Future<void> deductCreditBillFromPayroll(String id, {String? notes}) async {
    await _dio.post('/cashier/credit-bills/$id/payroll-deduct', data: {
      if (notes != null && notes.trim().isNotEmpty) 'notes': notes.trim(),
    });
  }

  // ── Customer credit bills (unpaid bills) ──────────────────────────────────
  Future<List<Map<String, dynamic>>> getCustomerUnpaidBills() async {
    final branchId = await getBranchId();
    return _getList('/cashier/unpaid-bills', query: {
      if (branchId.isNotEmpty) 'branch_id': branchId,
    });
  }

  Future<Map<String, dynamic>> createCustomerUnpaidBill(
      Map<String, dynamic> data) async {
    final branchId = await getBranchId();
    final res = await _dio.post('/cashier/unpaid-bills', data: {
      if (branchId.isNotEmpty) 'branch_id': int.tryParse(branchId) ?? branchId,
      ...data,
    });
    return _asMap(res.data);
  }

  Future<void> recordUnpaidBillPayment(
      String id, Map<String, dynamic> data) async {
    await _dio.post('/cashier/unpaid-bills/$id/payment', data: data);
  }

  Future<File> downloadUnpaidBillInvoice(String id) async {
    final res = await _dio.get<List<int>>(
      '/cashier/unpaid-bills/$id/pdf',
      options: Options(responseType: ResponseType.bytes),
    );
    return _saveBytes(res.data ?? const [], 'Customer_Credit_$id.pdf');
  }

  Future<File> downloadOutstandingCustomerCredits() async {
    final branchId = await getBranchId();
    final res = await _dio.get<List<int>>(
      '/cashier/unpaid-bills/outstanding/pdf',
      queryParameters: {if (branchId.isNotEmpty) 'branch_id': branchId},
      options: Options(responseType: ResponseType.bytes),
    );
    return _saveBytes(res.data ?? const [], 'Outstanding_Customer_Credits.pdf');
  }

  Future<List<Map<String, dynamic>>> getFinanceInvoices() async {
    final branchId = await getBranchId();
    try {
      return await _getList('/finance/invoices', query: {
        if (branchId.isNotEmpty) 'branch_id': branchId,
      });
    } on DioException catch (e) {
      // Invoice register is optional; degrade to empty instead of an error page
      if (e.response?.statusCode == 500 ||
          e.response?.statusCode == 404 ||
          e.response?.statusCode == 403) {
        return [];
      }
      rethrow;
    }
  }

  Future<List<Map<String, dynamic>>> getFinanceTransactions() async {
    final branchId = await getBranchId();
    try {
      return await _getList('/finance/transactions', query: {
        if (branchId.isNotEmpty) 'branch_id': branchId,
      });
    } on DioException catch (e) {
      if (e.response?.statusCode == 500 ||
          e.response?.statusCode == 404 ||
          e.response?.statusCode == 403) {
        return [];
      }
      rethrow;
    }
  }

  Future<List<Map<String, dynamic>>> getPendingFoodVariances() async {
    final branchId = await getBranchId();
    return _getList('/food-control/variance/pending', query: {
      if (branchId.isNotEmpty) 'branch_id': branchId,
    });
  }

  Future<void> approveFoodVariance(String id) async {
    await _dio.post('/food-control/variance/$id/approve');
  }

  Future<void> flagFoodVariance(String id, String notes) async {
    await _dio.post('/food-control/variance/$id/flag', data: {
      if (notes.trim().isNotEmpty) 'notes': notes.trim(),
    });
  }

  Future<List<Map<String, dynamic>>> getShiftPnLs({
    String status = 'all',
  }) async {
    final branchId = await getBranchId();
    try {
      return await _getList('/finance/shift-pnl', query: {
        if (branchId.isNotEmpty) 'branch_id': branchId,
        if (status != 'all') 'status': status,
      });
    } on DioException catch (e) {
      // Shift P&L is optional for this role/deployment — degrade to empty
      if (e.response?.statusCode == 403 || e.response?.statusCode == 404) {
        return [];
      }
      rethrow;
    }
  }

  Future<Map<String, dynamic>> getShiftPnLSummary() async {
    final branchId = await getBranchId();
    try {
      return await _getMap('/finance/shift-pnl/summary', query: {
        if (branchId.isNotEmpty) 'branch_id': branchId,
      });
    } on DioException catch (e) {
      if (e.response?.statusCode == 403 || e.response?.statusCode == 404) {
        return {};
      }
      rethrow;
    }
  }

  Future<void> reviewShiftPnL(String shiftId, String notes) async {
    await _dio.post('/finance/shift-pnl/$shiftId/review', data: {
      if (notes.trim().isNotEmpty) 'notes': notes.trim(),
    });
  }

  Future<List<Map<String, dynamic>>> getStockTakes() async {
    final branchId = await getBranchId();
    return _getList('/stock-takes', query: {
      if (branchId.isNotEmpty) 'branch_id': branchId,
    });
  }

  Future<Map<String, dynamic>> createStockTake({
    String countType = 'monthly',
    String? notes,
  }) async {
    final branchId = await getBranchId();
    final res = await _dio.post('/stock-takes', data: {
      if (branchId.isNotEmpty) 'branch_id': int.tryParse(branchId) ?? branchId,
      'count_type': countType,
      if (notes != null) 'notes': notes,
    });
    return _asMap(res.data);
  }

  Future<File> downloadStockTakeWorksheet({String? stockTakeId}) async {
    final branchId = await getBranchId();
    final path = stockTakeId != null
        ? '/stock-takes/$stockTakeId/worksheet'
        : '/stock-takes/worksheet';
    final res = await _dio.get<List<int>>(
      path,
      queryParameters: {
        if (stockTakeId == null && branchId.isNotEmpty) 'branch_id': branchId,
      },
      options: Options(responseType: ResponseType.bytes),
    );
    return _saveBytes(
      res.data ?? const [],
      'Stock_Take_Worksheet_${stockTakeId ?? DateTime.now().millisecondsSinceEpoch}.pdf',
    );
  }

  Future<List<Map<String, dynamic>>> getPurchaseOrders({String? status}) {
    return _getList('/procurement/purchase-orders', query: {
      'source_module': 'branch_accounting',
      if (status != null && status.isNotEmpty) 'status': status,
    });
  }

  Future<List<Map<String, dynamic>>> getSupplierInvoices() {
    return _getList('/procurement/invoices');
  }

  Future<List<Map<String, dynamic>>> getSupplierPayments() {
    return _getList('/procurement/payments');
  }

  // Suppliers (branch-scoped) for PO/invoice creation
  Future<List<Map<String, dynamic>>> getSuppliers() {
    return _getList('/store/suppliers', query: {'scope': 'branch'});
  }

  // Catalog items for PO line selection
  Future<List<Map<String, dynamic>>> getStoreItems() {
    return _getList('/store/items', query: {'limit': 1000});
  }

  Future<Map<String, dynamic>> getInvoiceDetail(String id) {
    return _getMap('/procurement/invoices/$id');
  }

  Future<Map<String, dynamic>> createPurchaseOrder(
      Map<String, dynamic> data) async {
    final res = await _dio.post('/procurement/purchase-orders', data: data);
    return _asMap(res.data);
  }

  Future<Map<String, dynamic>> createSupplierInvoice(
      Map<String, dynamic> data) async {
    final res = await _dio.post('/procurement/invoices', data: data);
    return _asMap(res.data);
  }

  Future<List<Map<String, dynamic>>> getBuffets() {
    return _getList('/buffet');
  }

  Future<void> openBuffet(String id) async {
    await _dio.post('/buffet/$id/open');
  }

  Future<void> closeBuffet(String id, Map<String, dynamic> data) async {
    await _dio.post('/buffet/$id/close', data: data);
  }

  Future<void> cancelBuffet(String id, String reason) async {
    await _dio.post('/buffet/$id/cancel', data: {
      if (reason.trim().isNotEmpty) 'reason': reason.trim(),
    });
  }

  Future<List<Map<String, dynamic>>> getCateringEvents() {
    return _getList('/catering-food-control/events');
  }

  Future<void> completeCateringEvent(String id) async {
    await _dio.post('/catering-food-control/events/$id/complete');
  }

  Future<void> cancelCateringEvent(String id, String reason) async {
    await _dio.post('/catering-food-control/events/$id/cancel', data: {
      if (reason.trim().isNotEmpty) 'reason': reason.trim(),
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
    var data = value is Map
        ? value['data'] ??
            value['items'] ??
            value['records'] ??
            value['analysis'] ??
            []
        : value;
    if (data is Map) {
      data = data['data'] ??
          data['items'] ??
          data['records'] ??
          data['rows'] ??
          data['results'] ??
          data['clearances'] ??
          data['logbooks'] ??
          data['transactions'] ??
          data['invoices'] ??
          data['payments'] ??
          data['purchase_orders'] ??
          data['purchaseOrders'] ??
          data['stock_takes'] ??
          data['stockTakes'] ??
          [];
    }
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
