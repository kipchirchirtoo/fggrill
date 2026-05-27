import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../network/dio_client.dart';
import 'api_service.dart';

final financeServiceProvider = Provider<FinanceService>((ref) {
  return FinanceService(ref.watch(dioProvider));
});

class FinanceService extends BaseApiService {
  FinanceService(super.dio);

  // GET /api/finance/overview
  Future<Map<String, dynamic>> getFinanceOverview(
      {int? branchId,
      String? period,
      String? startDate,
      String? endDate}) async {
    final query = {
      if (branchId != null) 'branchId': branchId,
      if (branchId != null) 'branch_id': branchId,
      if (period != null) 'period': period,
      if (startDate != null) 'startDate': startDate,
      if (endDate != null) 'endDate': endDate,
    };
    final response = await get<Map<String, dynamic>>('/finance/overview',
        queryParameters: query);
    return response;
  }

  // GET /api/finance/revenue
  Future<Map<String, dynamic>> getRevenue({
    String? startDate,
    String? endDate,
    int? branchId,
    String? groupBy,
  }) async {
    final query = {
      if (startDate != null) 'startDate': startDate,
      if (endDate != null) 'endDate': endDate,
      if (branchId != null) 'branchId': branchId,
      if (branchId != null) 'branch_id': branchId,
      if (groupBy != null) 'groupBy': groupBy,
    };
    final response = await get<Map<String, dynamic>>('/finance/revenue',
        queryParameters: query);
    return response;
  }

  // GET /api/finance/expenses
  Future<Map<String, dynamic>> getExpenses({
    String? startDate,
    String? endDate,
    String? category,
    int? branchId,
  }) async {
    final query = {
      if (startDate != null) 'startDate': startDate,
      if (endDate != null) 'endDate': endDate,
      if (category != null) 'category': category,
      if (branchId != null) 'branchId': branchId,
      if (branchId != null) 'branch_id': branchId,
    };
    final response = await get<Map<String, dynamic>>('/finance/expenses',
        queryParameters: query);
    return response;
  }

  // POST /api/finance/expenses
  Future<Map<String, dynamic>> createExpense(
      Map<String, dynamic> expense) async {
    final response =
        await post<Map<String, dynamic>>('/finance/expenses', data: expense);
    return response;
  }

  // GET /api/finance/budgets
  Future<Map<String, dynamic>> getBudgets({int? branchId, String? year}) async {
    final query = {
      if (branchId != null) 'branchId': branchId,
      if (branchId != null) 'branch_id': branchId,
      if (year != null) 'year': year,
      if (year != null) 'fiscal_year': year,
    };
    final response = await get<Map<String, dynamic>>('/finance/budgets',
        queryParameters: query);
    return response;
  }

  // POST /api/finance/budgets
  Future<Map<String, dynamic>> createBudget(Map<String, dynamic> budget) async {
    final response =
        await post<Map<String, dynamic>>('/finance/budgets', data: budget);
    return response;
  }

  // GET /api/finance/profit-loss
  Future<Map<String, dynamic>> getProfitLoss({
    String? startDate,
    String? endDate,
    int? branchId,
  }) async {
    final query = {
      if (startDate != null) 'startDate': startDate,
      if (endDate != null) 'endDate': endDate,
      if (branchId != null) 'branchId': branchId,
      if (branchId != null) 'branch_id': branchId,
    };
    final response = await get<Map<String, dynamic>>('/finance/profit-loss',
        queryParameters: query);
    return response;
  }

  // GET /api/finance/revenue-oversight
  Future<Map<String, dynamic>> getRevenueOversight(
      {int? branchId, String? date}) async {
    final query = {
      if (branchId != null) 'branchId': branchId,
      if (date != null) 'date': date,
    };
    final response = await get<Map<String, dynamic>>(
        '/finance/revenue-oversight',
        queryParameters: query);
    return response;
  }

  // GET /api/finance/banking
  Future<Map<String, dynamic>> getBanking({int? branchId}) async {
    final query = {if (branchId != null) 'branchId': branchId};
    final response = await get<Map<String, dynamic>>('/finance/banking',
        queryParameters: query);
    return response;
  }

  // POST /api/finance/banking/transactions
  Future<Map<String, dynamic>> recordBankTransaction(
      Map<String, dynamic> transaction) async {
    final response = await post<Map<String, dynamic>>(
        '/finance/banking/transactions',
        data: transaction);
    return response;
  }

  // GET /api/finance/credit-bills
  Future<Map<String, dynamic>> getCreditBills({
    String? status,
    int? branchId,
    int page = 1,
    int limit = 50,
  }) async {
    final query = {
      if (status != null) 'status': status,
      if (branchId != null) 'branchId': branchId,
      if (branchId != null) 'branch_id': branchId,
      'page': page,
      'limit': limit,
    };
    final response = await get<Map<String, dynamic>>('/payroll/credit-bills',
        queryParameters: query);
    return response;
  }

  // POST /api/finance/credit-bills
  Future<Map<String, dynamic>> createCreditBill(
      Map<String, dynamic> bill) async {
    final response =
        await post<Map<String, dynamic>>('/finance/credit-bills', data: bill);
    return response;
  }

  // POST /api/finance/credit-bills/:id/payment
  Future<Map<String, dynamic>> recordCreditPayment(
      String id, Map<String, dynamic> payment) async {
    final response = await post<Map<String, dynamic>>(
        '/finance/credit-bills/$id/payment',
        data: payment);
    return response;
  }

  // GET /api/accounting/journal-entries
  Future<Map<String, dynamic>> getJournalEntries({
    String? startDate,
    String? endDate,
    int? branchId,
  }) async {
    final query = {
      if (startDate != null) 'startDate': startDate,
      if (endDate != null) 'endDate': endDate,
      if (branchId != null) 'branchId': branchId,
    };
    final response = await get<Map<String, dynamic>>(
        '/accounting/journal-entries',
        queryParameters: query);
    return response;
  }

  // POST /api/accounting/journal-entries
  Future<Map<String, dynamic>> createJournalEntry(
      Map<String, dynamic> entry) async {
    final response = await post<Map<String, dynamic>>(
        '/accounting/journal-entries',
        data: entry);
    return response;
  }

  // GET /api/finance/daily-logs
  Future<Map<String, dynamic>> getDailyLogs(
      {String? date, int? branchId}) async {
    final query = {
      if (date != null) 'date': date,
      if (date != null) 'log_date': date,
      if (branchId != null) 'branchId': branchId,
      if (branchId != null) 'branch_id': branchId,
    };
    final response = await get<Map<String, dynamic>>('/finance/daily-logs',
        queryParameters: query);
    return response;
  }

  // POST /api/finance/daily-logs
  Future<Map<String, dynamic>> createDailyLog(Map<String, dynamic> log) async {
    final response =
        await post<Map<String, dynamic>>('/finance/daily-logs', data: log);
    return response;
  }

  // GET /api/finance/shift-pnl
  Future<Map<String, dynamic>> getShiftPnL(
      {String? shiftId, int? branchId}) async {
    final query = {
      if (shiftId != null) 'shiftId': shiftId,
      if (branchId != null) 'branchId': branchId,
    };
    final response = await get<Map<String, dynamic>>('/finance/shift-pnl',
        queryParameters: query);
    return response;
  }

  // GET /api/finance/reconciliation
  Future<Map<String, dynamic>> getReconciliation(
      {String? date, int? branchId}) async {
    final query = {
      if (date != null) 'date': date,
      if (branchId != null) 'branchId': branchId,
    };
    final response = await get<Map<String, dynamic>>('/finance/reconciliation',
        queryParameters: query);
    return response;
  }
}
