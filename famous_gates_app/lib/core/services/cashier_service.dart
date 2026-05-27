import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../network/dio_client.dart';
import 'api_service.dart';

final cashierServiceProvider = Provider<CashierService>((ref) {
  return CashierService(ref.watch(dioProvider));
});

class CashierService extends BaseApiService {
  CashierService(super.dio);

  // ==================== CASHIER SHIFT ====================

  // GET /api/cashier/shift
  Future<Map<String, dynamic>> getCurrentShift({int? branchId}) async {
    final query = {if (branchId != null) 'branchId': branchId};
    final response = await get<Map<String, dynamic>>('/cashier/shift',
        queryParameters: query);
    return response;
  }

  // POST /api/cashier/shift/open
  Future<Map<String, dynamic>> openShift(Map<String, dynamic> shift) async {
    final response =
        await post<Map<String, dynamic>>('/cashier/shift/open', data: shift);
    return response;
  }

  // POST /api/cashier/shift/close
  Future<Map<String, dynamic>> closeShift(Map<String, dynamic> shift) async {
    final response =
        await post<Map<String, dynamic>>('/cashier/shift/close', data: shift);
    return response;
  }

  // GET /api/cashier/shift/:id/report
  Future<Map<String, dynamic>> getShiftReport(String shiftId) async {
    final response =
        await get<Map<String, dynamic>>('/cashier/shift/$shiftId/report');
    return response;
  }

  // ==================== PAYMENTS ====================

  // GET /api/payments
  Future<Map<String, dynamic>> getPayments({
    String? status,
    String? method,
    String? startDate,
    String? endDate,
    int? branchId,
    int page = 1,
    int limit = 50,
  }) async {
    final query = {
      if (status != null) 'status': status,
      if (method != null) 'method': method,
      if (startDate != null) 'startDate': startDate,
      if (endDate != null) 'endDate': endDate,
      if (branchId != null) 'branchId': branchId,
      'page': page,
      'limit': limit,
    };
    final response =
        await get<Map<String, dynamic>>('/payments', queryParameters: query);
    return response;
  }

  // GET /api/payments/:id
  Future<Map<String, dynamic>> getPayment(String id) async {
    final response = await get<Map<String, dynamic>>('/payments/$id');
    return response;
  }

  // POST /api/payments
  Future<Map<String, dynamic>> createPayment(
      Map<String, dynamic> payment) async {
    final response =
        await post<Map<String, dynamic>>('/payments', data: payment);
    return response;
  }

  // POST /api/payments/:id/refund
  Future<Map<String, dynamic>> refundPayment(String id,
      {double? amount, String? reason}) async {
    final response = await post<Map<String, dynamic>>(
      '/payments/$id/refund',
      data: {
        if (amount != null) 'amount': amount,
        if (reason != null) 'reason': reason,
      },
    );
    return response;
  }

  // POST /api/payments/:id/void
  Future<Map<String, dynamic>> voidPayment(String id,
      {String? reason, String? authorizedBy}) async {
    final response = await post<Map<String, dynamic>>(
      '/payments/$id/void',
      data: {
        if (reason != null) 'reason': reason,
        if (authorizedBy != null) 'authorizedBy': authorizedBy,
      },
    );
    return response;
  }

  // ==================== PETTY CASH ====================

  // GET /api/petty-cash
  Future<Map<String, dynamic>> getPettyCash({
    String? type,
    String? status,
    String? startDate,
    String? endDate,
    int? branchId,
  }) async {
    final query = {
      if (type != null) 'type': type,
      if (status != null) 'status': status,
      if (startDate != null) 'startDate': startDate,
      if (endDate != null) 'endDate': endDate,
      if (branchId != null) 'branchId': branchId,
    };
    final response =
        await get<Map<String, dynamic>>('/petty-cash', queryParameters: query);
    return response;
  }

  // POST /api/petty-cash/issue
  Future<Map<String, dynamic>> issuePettyCash(
      Map<String, dynamic> request) async {
    final response =
        await post<Map<String, dynamic>>('/petty-cash/issue', data: request);
    return response;
  }

  // POST /api/petty-cash/topup
  Future<Map<String, dynamic>> topupPettyCash(
      Map<String, dynamic> request) async {
    final response =
        await post<Map<String, dynamic>>('/petty-cash/topup', data: request);
    return response;
  }

  // POST /api/petty-cash/reconcile
  Future<Map<String, dynamic>> reconcilePettyCash(
      Map<String, dynamic> reconciliation) async {
    final response = await post<Map<String, dynamic>>('/petty-cash/reconcile',
        data: reconciliation);
    return response;
  }

  // ==================== CASHIER FLOAT ====================

  // GET /api/cashier/float
  Future<Map<String, dynamic>> getFloat({int? branchId}) async {
    final query = {if (branchId != null) 'branchId': branchId};
    final response = await get<Map<String, dynamic>>('/cashier/float',
        queryParameters: query);
    return response;
  }

  // POST /api/cashier/float/adjust
  Future<Map<String, dynamic>> adjustFloat(
      Map<String, dynamic> adjustment) async {
    final response = await post<Map<String, dynamic>>('/cashier/float/adjust',
        data: adjustment);
    return response;
  }

  // ==================== SHIFT PnL ====================

  // GET /api/shift-pnl
  Future<Map<String, dynamic>> getShiftPnL(
      {String? shiftId, int? branchId}) async {
    final query = {
      if (shiftId != null) 'shiftId': shiftId,
      if (branchId != null) 'branchId': branchId,
    };
    final response =
        await get<Map<String, dynamic>>('/shift-pnl', queryParameters: query);
    return response;
  }

  // POST /api/shift-pnl/calculate
  Future<Map<String, dynamic>> calculateShiftPnL(
      Map<String, dynamic> data) async {
    final response =
        await post<Map<String, dynamic>>('/shift-pnl/calculate', data: data);
    return response;
  }

  // ==================== SHIFTS ====================

  // GET /api/shifts
  Future<Map<String, dynamic>> getShifts({
    String? status,
    String? startDate,
    String? endDate,
    int? cashierId,
    int? branchId,
    int page = 1,
    int limit = 50,
  }) async {
    final query = {
      if (status != null) 'status': status,
      if (startDate != null) 'startDate': startDate,
      if (endDate != null) 'endDate': endDate,
      if (cashierId != null) 'cashierId': cashierId,
      if (branchId != null) 'branchId': branchId,
      'page': page,
      'limit': limit,
    };
    final response =
        await get<Map<String, dynamic>>('/shifts', queryParameters: query);
    return response;
  }

  // GET /api/shifts/:id
  Future<Map<String, dynamic>> getShift(String id) async {
    final response = await get<Map<String, dynamic>>('/shifts/$id');
    return response;
  }

  // ==================== RECEIPTS ====================

  // GET /api/receipts
  Future<Map<String, dynamic>> getReceipts({
    String? type,
    String? date,
    int? branchId,
    int page = 1,
    int limit = 50,
  }) async {
    final query = {
      if (type != null) 'type': type,
      if (date != null) 'date': date,
      if (branchId != null) 'branchId': branchId,
      'page': page,
      'limit': limit,
    };
    final response =
        await get<Map<String, dynamic>>('/receipts', queryParameters: query);
    return response;
  }

  // GET /api/receipts/:id
  Future<Map<String, dynamic>> getReceipt(String id) async {
    final response = await get<Map<String, dynamic>>('/receipts/$id');
    return response;
  }

  // POST /api/receipts/reprint
  Future<Map<String, dynamic>> reprintReceipt(String id) async {
    final response = await post<Map<String, dynamic>>('/receipts/$id/reprint');
    return response;
  }
}
