import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/network/dio_client.dart';
import '../../../core/storage/secure_storage_provider.dart';
import '../../auth/data/auth_repository.dart';
import '../domain/models.dart';

final financeRepositoryProvider = Provider<FinanceRepository>((ref) {
  return FinanceRepository(ref.read(dioProvider), ref);
});

class FinanceRepository {
  FinanceRepository(this._dio, this._ref);

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

  Future<FinanceOverview> getDashboard() async {
    final branchId = await _branchId;
    final response = await _dio.get('/finance/dashboard', queryParameters: {
      if (branchId.isNotEmpty) 'branch_id': branchId,
    });
    return FinanceOverview.fromJson(_unwrap(response.data));
  }

  Future<List<Invoice>> getInvoices({String? status}) async {
    final branchId = await _branchId;
    final response = await _dio.get('/accounting/invoices', queryParameters: {
      if (branchId.isNotEmpty) 'branch_id': branchId,
      if (status != null) 'status': status,
    });
    return _parseList(response.data, Invoice.fromJson);
  }

  Future<void> createInvoice(Map<String, dynamic> data) async {
    await _dio.post('/accounting/invoices', data: data);
  }

  Future<List<Bill>> getBills({String? status}) async {
    final branchId = await _branchId;
    final response = await _dio.get('/accounting/bills', queryParameters: {
      if (branchId.isNotEmpty) 'branch_id': branchId,
      if (status != null) 'status': status,
    });
    return _parseList(response.data, Bill.fromJson);
  }

  Future<List<PaymentVerification>> getPayments({String? status}) async {
    final branchId = await _branchId;
    final response = await _dio.get('/payments-verification', queryParameters: {
      if (branchId.isNotEmpty) 'branch_id': branchId,
      if (status != null) 'status': status,
    });
    return _parseList(response.data, PaymentVerification.fromJson);
  }

  Future<void> verifyPayment(String id, String status, {String? notes}) async {
    await _dio.put('/payments-verification/$id/verify-auditor', data: {
      'auditor_status': status,
      'auditor_notes': notes,
    });
  }

  Future<void> approvePayment(String id, {String? notes}) async {
    await _dio.put('/payments-verification/$id/verify-accountant', data: {
      'accountant_notes': notes,
    });
  }

  Future<List<PettyCashTransaction>> getPettyCashTransactions() async {
    final branchId = await _branchId;
    final response = await _dio.get('/petty-cash', queryParameters: {
      if (branchId.isNotEmpty) 'branch_id': branchId,
    });
    return _parseList(response.data, PettyCashTransaction.fromJson);
  }

  Future<void> createPettyCashRequest(Map<String, dynamic> data) async {
    await _dio.post('/petty-cash', data: data);
  }

  Future<void> updatePettyCashStatus(String id, String status,
      {String? remarks}) async {
    await _dio.patch('/petty-cash/$id/status', data: {
      'status': status,
      if (remarks != null) 'remarks': remarks,
    });
  }

  Future<List<BankAccount>> getBankAccounts() async {
    final branchId = await _branchId;
    final response =
        await _dio.get('/accounting/bank-accounts', queryParameters: {
      if (branchId.isNotEmpty) 'branch_id': branchId,
    });
    return _parseList(response.data, BankAccount.fromJson);
  }

  Future<List<BankingRecord>> getBankingRecords() async {
    final branchId = await _branchId;
    final response = await _dio.get('/banking', queryParameters: {
      if (branchId.isNotEmpty) 'branch_id': branchId,
    });
    return _parseList(response.data, BankingRecord.fromJson);
  }

  Future<void> createBankingRecord(Map<String, dynamic> data) async {
    await _dio.post('/banking', data: data);
  }

  Future<List<Map<String, dynamic>>> getDailyLogs() async {
    final branchId = await _branchId;
    final response = await _dio.get('/finance/daily-logs', queryParameters: {
      if (branchId.isNotEmpty) 'branch_id': branchId,
    });
    final data = response.data;
    final list =
        data is List ? data : (data is Map ? (data['data'] ?? []) : []);
    return (list as List)
        .whereType<Map>()
        .map((e) => Map<String, dynamic>.from(e))
        .toList();
  }

  Future<void> createDailyLog(Map<String, dynamic> log) async {
    await _dio.post('/finance/daily-logs', data: log);
  }

  Future<void> updateDailyLogStatus(String id, String status) async {
    await _dio.put('/finance/daily-logs/$id/status', data: {'status': status});
  }

  Future<List<ShiftPnL>> getShiftPnL() async {
    final branchId = await _branchId;
    final response = await _dio.get('/finance/shift-pnl', queryParameters: {
      if (branchId.isNotEmpty) 'branch_id': branchId,
    });
    return _parseList(response.data, ShiftPnL.fromJson);
  }

  Future<List<CreditBill>> getCreditBills() async {
    final branchId = await _branchId;
    final response = await _dio.get('/credit', queryParameters: {
      if (branchId.isNotEmpty) 'branch_id': branchId,
    });
    return _parseList(response.data, CreditBill.fromJson);
  }

  Future<void> createCreditBill(Map<String, dynamic> data) async {
    await _dio.post('/credit', data: data);
  }

  Future<List<Buffet>> getBuffets() async {
    final branchId = await _branchId;
    final response = await _dio.get('/buffet', queryParameters: {
      if (branchId.isNotEmpty) 'branch_id': branchId,
    });
    return _parseList(response.data, Buffet.fromJson);
  }

  Future<void> createBuffet(Map<String, dynamic> data) async {
    await _dio.post('/buffet', data: data);
  }

  Future<List<CateringBooking>> getCateringBookings() async {
    final branchId = await _branchId;
    final response = await _dio.get('/catering-bookings', queryParameters: {
      if (branchId.isNotEmpty) 'branch_id': branchId,
    });
    return _parseList(response.data, CateringBooking.fromJson);
  }

  Future<void> createCateringBooking(Map<String, dynamic> data) async {
    await _dio.post('/catering-bookings', data: data);
  }

  Future<List<PettyCashEntry>> getPettyCashEntries() async {
    final branchId = await _branchId;
    final response = await _dio.get('/petty-cash', queryParameters: {
      if (branchId.isNotEmpty) 'branch_id': branchId,
    });
    return _parseList(response.data, PettyCashEntry.fromJson);
  }

  Future<void> createPettyCashEntry(Map<String, dynamic> data) async {
    await _dio.post('/petty-cash', data: data);
  }

  Future<List<Purchase>> getPurchases() async {
    final branchId = await _branchId;
    final response = await _dio.get('/procurement', queryParameters: {
      if (branchId.isNotEmpty) 'branch_id': branchId,
    });
    return _parseList(response.data, Purchase.fromJson);
  }

  Future<void> createPurchase(Map<String, dynamic> data) async {
    await _dio.post('/procurement', data: data);
  }

  Future<Map<String, dynamic>> getFoodControlConfig() async {
    final branchId = await _branchId;
    final response = await _dio.get('/food-control', queryParameters: {
      if (branchId.isNotEmpty) 'branch_id': branchId,
    });
    return _unwrap(response.data);
  }

  Future<void> updateFoodControlConfig(Map<String, dynamic> data) async {
    await _dio.put('/food-control', data: data);
  }

  Future<List<CashierClearance>> getCashierClearances() async {
    final branchId = await _branchId;
    final response = await _dio.get('/cashier/clearance', queryParameters: {
      if (branchId.isNotEmpty) 'branch_id': branchId,
    });
    return _parseList(response.data, CashierClearance.fromJson);
  }

  Future<void> approveCashierClearance(String id) async {
    await _dio.post('/cashier/clearance/$id/approve');
  }

  Future<Map<String, dynamic>> getVarianceReport() async {
    final branchId = await _branchId;
    final response = await _dio.get('/reports/variance', queryParameters: {
      if (branchId.isNotEmpty) 'branch_id': branchId,
    });
    return _unwrap(response.data);
  }

  Future<List<BookingInvoice>> getBookingsInvoices() async {
    final branchId = await _branchId;
    final response = await _dio.get('/accounting/invoices', queryParameters: {
      if (branchId.isNotEmpty) 'branch_id': branchId,
      'include_bookings': true,
    });
    return _parseList(response.data, BookingInvoice.fromJson);
  }

  Future<void> rejectPayment(String id, {String? notes}) async {
    await _dio.put('/payments-verification/$id/reject', data: {
      if (notes != null) 'notes': notes,
    });
  }
}
