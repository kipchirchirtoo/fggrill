import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:path_provider/path_provider.dart';
import 'dart:io';

import '../../../core/network/dio_client.dart';
import '../../../core/storage/secure_storage_provider.dart';
import '../../auth/data/auth_repository.dart';
import '../../auth/domain/auth_notifier.dart';

final branchAccountantRepositoryProvider =
    Provider<BranchAccountantRepository>((ref) {
  return BranchAccountantRepository(ref.watch(dioProvider), ref);
});

class BranchAccountantRepository {
  BranchAccountantRepository(this._dio, this._ref);

  final Dio _dio;
  final Ref _ref;

  Future<String> getBranchId() async {
    final authBranchId =
        _ref.read(authNotifierProvider).valueOrNull?.branchId.trim() ?? '';
    if (_validBranchId(authBranchId)) return authBranchId;
    final storage = _ref.read(secureStorageProvider);
    final storedBranchId =
        (await storage.read(key: AuthRepository.branchIdKey))?.trim() ?? '';
    return _validBranchId(storedBranchId) ? storedBranchId : '';
  }

  bool _validBranchId(String value) {
    final normalized = value.trim().toLowerCase();
    return normalized.isNotEmpty &&
        normalized != '0' &&
        normalized != 'null' &&
        normalized != 'nan';
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
      format.toLowerCase() == 'pdf'
          ? 'FG_Branch_Sales_${startDate}_to_$endDate.pdf'
          : 'branch-sales-$startDate-$endDate.$format',
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
    try {
      return await _getList('/finance/workspace/daily', query: {
        if (branchId.isNotEmpty) 'branch_id': branchId,
        'start_date': startDate,
        'end_date': endDate,
      });
    } on DioException catch (e) {
      if (_isRecoverableBranchEndpointError(e)) return [];
      rethrow;
    }
  }

  Future<Map<String, dynamic>> getDailyRecordByDate(String date) async {
    final branchId = await getBranchId();
    return _getMap('/finance/workspace/daily/$date', query: {
      if (branchId.isNotEmpty) 'branch_id': branchId,
    });
  }

  /// Lina AI: collect every available system figure for [date] and shape it
  /// into the daily financial entry form (revenue/payments/banking/cogs/expenses).
  Future<Map<String, dynamic>> getDailyAutofill(String date) async {
    final branchId = await getBranchId();
    return _getMap('/finance/workspace/daily/autofill', query: {
      if (branchId.isNotEmpty) 'branch_id': branchId,
      'date': date,
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
    try {
      return await _getList('/finance/discrepancies', query: {
        if (branchId.isNotEmpty) 'branch_id': branchId,
      });
    } on DioException catch (e) {
      if (_isRecoverableBranchEndpointError(e)) return [];
      rethrow;
    }
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

  /// Per-POS-outlet P&L sourced from cashier transactions + sold items.
  Future<Map<String, dynamic>> getPosProfitLoss({
    required String fromDate,
    required String toDate,
  }) async {
    final branchId = await getBranchId();
    return _getMap('/finance/pos-profit-loss', query: {
      if (branchId.isNotEmpty) 'branch_id': branchId,
      'from_date': fromDate,
      'to_date': toDate,
    });
  }

  /// Download the FamousGate-branded P&L PDF generated server-side.
  Future<File> exportPosProfitLossPdf({
    required String fromDate,
    required String toDate,
  }) async {
    final branchId = await getBranchId();
    final res = await _dio.get<List<int>>(
      '/finance/pos-profit-loss/export/pdf',
      queryParameters: {
        if (branchId.isNotEmpty) 'branch_id': branchId,
        'from_date': fromDate,
        'to_date': toDate,
      },
      options: Options(responseType: ResponseType.bytes),
    );
    return _saveBytes(
      res.data ?? const [],
      'FG_Profit_Loss_${fromDate}_$toDate.pdf',
    );
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

  Future<File> downloadSoldItemsReport({
    required String startDate,
    required String endDate,
  }) async {
    final branchId = await getBranchId();
    final res = await _dio.get<List<int>>(
      '/auditor/verify/sold-items/export/pdf',
      queryParameters: {
        if (branchId.isNotEmpty) 'branch_id': branchId,
        'start_date': startDate,
        'end_date': endDate,
      },
      options: Options(responseType: ResponseType.bytes),
    );
    return _saveBytes(
      res.data ?? const [],
      'FG_Sold_Items_${startDate}_to_$endDate.pdf',
    );
  }

  Future<Map<String, dynamic>> getStaffAudit({
    required String startDate,
    required String endDate,
    String? staffId,
  }) async {
    final branchId = await getBranchId();
    final audit = await _getMap('/auditor/staff-audit', query: {
      if (branchId.isNotEmpty) 'branch_id': branchId,
      'start_date': startDate,
      'end_date': endDate,
      if (staffId != null && staffId != 'all') 'staff_id': staffId,
    });
    try {
      final staff = await getBranchStaff();
      return _enrichStaffAuditWithProfiles(audit, staff);
    } catch (_) {
      return audit;
    }
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
    try {
      return await _getList('/banking/transactions', query: {
        if (branchId.isNotEmpty) 'branch_id': branchId,
        if (status != 'all') 'status': status,
      });
    } on DioException catch (e) {
      if (_isRecoverableBranchEndpointError(e)) return [];
      rethrow;
    }
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
      'role': 'accountant',
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

  Future<List<Map<String, dynamic>>> getBranchStaff(
      {String search = ''}) async {
    final branchId = await getBranchId();
    return _getList('/staff', query: {
      if (branchId.isNotEmpty) 'branch_id': branchId,
      if (search.trim().isNotEmpty) 'search': search.trim(),
      'status': 'active',
      'limit': 500,
    });
  }

  Future<List<Map<String, dynamic>>> getPayrollCreditBills({
    String status = 'all',
    String? staffId,
  }) async {
    final branchId = await getBranchId();
    return _getList('/payroll/credit-bills', query: {
      if (branchId.isNotEmpty) 'branch_id': branchId,
      if (status != 'all') 'status': status,
      if (staffId != null && staffId.isNotEmpty) 'staff_id': staffId,
    });
  }

  Future<Map<String, dynamic>> createPayrollCreditBill(
      Map<String, dynamic> data) async {
    final branchId = await getBranchId();
    final res = await _dio.post('/payroll/credit-bills', data: {
      if (branchId.isNotEmpty) 'branch_id': int.tryParse(branchId) ?? branchId,
      ...data,
    });
    return _asMap(res.data);
  }

  Future<void> recordPayrollCreditBillPayment(
    String id,
    Map<String, dynamic> data,
  ) async {
    await _dio.post('/payroll/credit-bills/$id/partial-payment', data: data);
  }

  Future<void> updatePayrollCreditBillStatus(String id, String status) async {
    await _dio.patch('/payroll/credit-bills/$id', data: {'status': status});
  }

  Future<List<Map<String, dynamic>>> getPayrollAdvances({
    String status = 'all',
    String? staffId,
  }) async {
    final branchId = await getBranchId();
    return _getList('/payroll/advances', query: {
      if (branchId.isNotEmpty) 'branch_id': branchId,
      if (status != 'all') 'status': status,
      if (staffId != null && staffId.isNotEmpty) 'staff_id': staffId,
    });
  }

  Future<Map<String, dynamic>> createPayrollAdvance(
      Map<String, dynamic> data) async {
    final branchId = await getBranchId();
    final res = await _dio.post('/payroll/advances', data: {
      if (branchId.isNotEmpty) 'branch_id': int.tryParse(branchId) ?? branchId,
      ...data,
    });
    return _asMap(res.data);
  }

  Future<List<Map<String, dynamic>>> getPayrollLoans({
    String status = 'all',
    String? staffId,
  }) async {
    final branchId = await getBranchId();
    return _getList('/payroll/loans', query: {
      if (branchId.isNotEmpty) 'branch_id': branchId,
      if (status != 'all') 'status': status,
      if (staffId != null && staffId.isNotEmpty) 'staff_id': staffId,
    });
  }

  Future<Map<String, dynamic>> createPayrollLoan(
      Map<String, dynamic> data) async {
    final branchId = await getBranchId();
    final res = await _dio.post('/payroll/loans', data: {
      if (branchId.isNotEmpty) 'branch_id': int.tryParse(branchId) ?? branchId,
      ...data,
    });
    return _asMap(res.data);
  }

  Future<void> recordPayrollLoanPayment(
    String id,
    Map<String, dynamic> data,
  ) async {
    await _dio.post('/payroll/loans/$id/payment', data: data);
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

  Future<List<Map<String, dynamic>>> getBranchPayments({
    String status = 'all',
    String? startDate,
    String? endDate,
  }) async {
    final branchId = await getBranchId();
    return _getList('/payments-verification', query: {
      if (branchId.isNotEmpty) 'branch_id': branchId,
      if (status != 'all') 'status': status,
      if (startDate != null && startDate.isNotEmpty) 'start_date': startDate,
      if (endDate != null && endDate.isNotEmpty) 'end_date': endDate,
    });
  }

  Future<Map<String, dynamic>> getBranchPaymentStats({
    String? startDate,
    String? endDate,
  }) async {
    final branchId = await getBranchId();
    return _getMap('/payments-verification/stats', query: {
      if (branchId.isNotEmpty) 'branch_id': branchId,
      if (startDate != null && startDate.isNotEmpty) 'start_date': startDate,
      if (endDate != null && endDate.isNotEmpty) 'end_date': endDate,
    });
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

  Future<List<Map<String, dynamic>>> getSupplierInvoices({
    String? supplierId,
    String? status,
    String? fromDate,
    String? toDate,
  }) {
    return _getList('/procurement/invoices', query: {
      if (supplierId != null && supplierId.isNotEmpty)
        'supplier_id': supplierId,
      if (status != null && status.isNotEmpty && status != 'all')
        'status': status,
      if (fromDate != null && fromDate.isNotEmpty) 'from_date': fromDate,
      if (toDate != null && toDate.isNotEmpty) 'to_date': toDate,
    });
  }

  Future<List<Map<String, dynamic>>> getSupplierPayments({
    String? supplierId,
    String? status,
    String? fromDate,
    String? toDate,
  }) {
    return _getList('/procurement/payments', query: {
      if (supplierId != null && supplierId.isNotEmpty)
        'supplier_id': supplierId,
      if (status != null && status.isNotEmpty && status != 'all')
        'status': status,
      if (fromDate != null && fromDate.isNotEmpty) 'from_date': fromDate,
      if (toDate != null && toDate.isNotEmpty) 'to_date': toDate,
    });
  }

  // Suppliers (branch-scoped) for PO/invoice creation
  Future<List<Map<String, dynamic>>> getSuppliers({
    String scope = 'branch',
    String? search,
  }) {
    return _getList('/store/suppliers', query: {
      'scope': scope,
      if (search != null && search.trim().isNotEmpty) 'search': search.trim(),
    });
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

  Future<Map<String, dynamic>> createSupplierPayment(
      Map<String, dynamic> data) async {
    final res = await _dio.post('/procurement/payments', data: data);
    return _asMap(res.data);
  }

  Future<Map<String, dynamic>> createStoreSupplier(
      Map<String, dynamic> data) async {
    final res = await _dio.post('/store/suppliers', data: data);
    return _asMap(res.data);
  }

  Future<Map<String, dynamic>> getSupplierAging({String? supplierId}) {
    return _getMap('/procurement/reports/aging', query: {
      if (supplierId != null && supplierId.isNotEmpty)
        'supplier_id': supplierId,
    });
  }

  Future<List<Map<String, dynamic>>> getSupplierLedger(String supplierId) {
    return _getList('/procurement/ledger/$supplierId');
  }

  Future<Map<String, dynamic>> getSupplierPerformance(String supplierId) {
    return _getMap('/procurement/performance/$supplierId');
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

  Future<List<Map<String, dynamic>>> getCateringEvents() async {
    try {
      return await _getList('/catering-food-control/events');
    } on DioException catch (e) {
      if (_isRecoverableBranchEndpointError(e)) return [];
      rethrow;
    }
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

  bool _isRecoverableBranchEndpointError(DioException error) {
    final status = error.response?.statusCode;
    if (status == 403 || status == 404) return true;
    if (status != 500) return false;
    final data = error.response?.data;
    final message = data is Map ? '${data['message'] ?? ''}' : '$data';
    return message.contains('Could not find a relationship') ||
        message.contains('schema cache');
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

  Map<String, dynamic> _enrichStaffAuditWithProfiles(
    Map<String, dynamic> audit,
    List<Map<String, dynamic>> staff,
  ) {
    if (staff.isEmpty) return audit;
    final enriched = Map<String, dynamic>.from(audit);
    final byId = <String, Map<String, dynamic>>{};
    final byEmployee = <String, Map<String, dynamic>>{};
    final byName = <String, Map<String, dynamic>>{};

    for (final profile in staff) {
      final id = _text(profile, const ['id', 'staff_id']);
      if (id.isNotEmpty) byId[id] = profile;
      final employeeId = _text(profile, const [
        'employee_id',
        'staff_code',
        'id_number',
        'national_id',
      ]);
      if (employeeId.isNotEmpty) byEmployee[_norm(employeeId)] = profile;
      final name = _staffName(profile);
      if (name.isNotEmpty) byName[_norm(name)] = profile;
    }

    Map<String, dynamic> enrichRow(Map<String, dynamic> row) {
      final profile = byId[_text(row, const ['staff_id', 'id'])] ??
          byEmployee[_norm(_text(row, const [
            'employee_id',
            'staff_code',
            'id_number',
            'national_id',
          ]))] ??
          byName[_norm(_text(row, const ['staff_name', 'name']))];
      if (profile == null) return row;

      final merged = Map<String, dynamic>.from(row);
      final salary = _firstPositiveNum(profile, const [
        'basic_salary',
        'salary',
        'monthly_salary',
        'gross_salary',
        'gross_pay',
        'net_pay',
      ]);
      if (_num(merged['salary']) <= 0 && salary > 0) {
        merged['salary'] = salary;
      }
      merged['basic_salary'] ??= salary > 0 ? salary : null;

      _fillText(merged, 'national_id', profile, const [
        'national_id',
        'id_number',
        'identity_number',
      ]);
      _fillText(merged, 'id_number', profile, const [
        'id_number',
        'national_id',
      ]);
      _fillText(merged, 'employee_id', profile, const [
        'employee_id',
        'staff_code',
        'id_number',
      ]);
      _fillText(merged, 'staff_code', profile, const [
        'staff_code',
        'employee_id',
        'id_number',
      ]);
      _fillText(merged, 'department', profile, const ['department']);
      _fillText(merged, 'role', profile, const ['role', 'position']);
      _fillText(merged, 'branch_name', profile, const ['branch_name']);
      return merged;
    }

    final summary = _asList(enriched['summary']);
    if (summary.isNotEmpty) {
      enriched['summary'] = summary.map(enrichRow).toList();
    }
    final records = _asList(enriched['data'] ?? enriched['records']);
    if (records.isNotEmpty) {
      enriched['data'] = records.map(enrichRow).toList();
    }
    return enriched;
  }

  List<Map<String, dynamic>> _asList(dynamic value) {
    var data = value is Map
        ? value['data'] ??
            value['items'] ??
            value['records'] ??
            value['staff'] ??
            value['staff_profiles'] ??
            value['employees'] ??
            value['analysis'] ??
            []
        : value;
    if (data is Map) {
      data = data['data'] ??
          data['items'] ??
          data['records'] ??
          data['staff'] ??
          data['staff_profiles'] ??
          data['employees'] ??
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

  String _staffName(Map<String, dynamic> row) {
    final explicit = _text(row, const ['staff_name', 'full_name', 'name']);
    if (explicit.isNotEmpty) return explicit;
    return [
      _text(row, const ['first_name', 'firstName']),
      _text(row, const ['last_name', 'lastName']),
    ].where((part) => part.isNotEmpty).join(' ').trim();
  }

  String _text(Map<String, dynamic> row, List<String> keys) {
    for (final key in keys) {
      final value = row[key];
      final text = value == null ? '' : '$value'.trim();
      if (text.isNotEmpty && text.toLowerCase() != 'null') return text;
    }
    return '';
  }

  void _fillText(
    Map<String, dynamic> target,
    String targetKey,
    Map<String, dynamic> source,
    List<String> sourceKeys,
  ) {
    final current = _text(target, [targetKey]);
    if (current.isNotEmpty && current.toLowerCase() != 'pending') return;
    final value = _text(source, sourceKeys);
    if (value.isNotEmpty) target[targetKey] = value;
  }

  String _norm(String value) =>
      value.trim().toLowerCase().replaceAll(RegExp(r'\s+'), ' ');

  num _num(dynamic value) {
    if (value is num) return value;
    return num.tryParse('$value') ?? 0;
  }

  num _firstPositiveNum(Map<String, dynamic> row, List<String> keys) {
    for (final key in keys) {
      final value = _num(row[key]);
      if (value > 0) return value;
    }
    return 0;
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
