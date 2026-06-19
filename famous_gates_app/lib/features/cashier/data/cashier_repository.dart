import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/dio_client.dart';
import '../../../core/utils/api_error_message.dart';

final cashierRepositoryProvider = Provider<CashierRepository>((ref) {
  return CashierRepository(
    ref.watch(dioProvider),
    ref.watch(pythonDioProvider),
  );
});

Map<String, dynamic> _withoutEmptyOptionalUuids(Map<String, dynamic> body) {
  final cleaned = Map<String, dynamic>.from(body);
  for (final key in const [
    'reference_id',
    'customer_id',
    'credit_bill_id',
    'staff_credit_bill_id',
  ]) {
    final value = cleaned[key];
    if (value is String && value.trim().isEmpty) cleaned.remove(key);
  }
  return cleaned;
}

class CashierRepository {
  CashierRepository(this._dio, this._pythonDio);

  final Dio _dio;
  final Dio _pythonDio;

  Future<Map<String, dynamic>> getStats() => _getMap('/cashier/stats');

  Future<Map<String, dynamic>> getBillDetails(String id) =>
      _getMap('/cashier/bill/${Uri.encodeComponent(id)}');

  Future<Map<String, dynamic>> processPayment({
    required String bookingId,
    required num amount,
    required String method,
    String? reference,
    Map<String, dynamic>? creditBill,
    num? tendered,
    num? change,
  }) {
    return _postMap('/cashier/pay', {
      'bookingId': bookingId,
      'amount': amount,
      'method': method,
      if (reference != null && reference.isNotEmpty) 'reference': reference,
      if (creditBill != null) 'credit_bill': creditBill,
      if (tendered != null && tendered > 0) 'amount_tendered': tendered,
      if (change != null && change > 0) 'change_given': change,
    });
  }

  Future<Map<String, dynamic>> verifyPayment(String paymentId) =>
      _postMap('/cashier/verify-payment/$paymentId', {});

  /// Backend fallback print — only call this when the client-side receipt
  /// print itself has already failed. The payment has already succeeded by
  /// this point; this is a last-resort attempt to still get a receipt out.
  Future<Map<String, dynamic>> printReceiptFallback({
    required String orderNumber,
    String? shortCode,
    String? customerName,
    required List<Map<String, dynamic>> items,
    required num amountPaid,
    String? paymentMethod,
    String? outletName,
  }) {
    return _postMap('/cashier/print-receipt-fallback', {
      'order_number': orderNumber,
      if (shortCode != null && shortCode.isNotEmpty) 'short_code': shortCode,
      'customer_name': customerName ?? 'Walk-in',
      'items': items,
      'amount_paid': amountPaid,
      'payment_method': paymentMethod ?? 'cash',
      'outlet_name': outletName ?? 'Restaurant',
    });
  }

  Future<List<Map<String, dynamic>>> getUnpaidBills({
    String? status,
    String? billType,
    String? search,
    String? date,
    int page = 1,
    int limit = 25,
  }) async {
    final query = {
      if (status != null && status != 'all') 'status': status,
      if (billType != null && billType != 'all') 'bill_type': billType,
      if (search != null && search.trim().isNotEmpty) 'search': search.trim(),
      if (date != null && date.trim().isNotEmpty) 'date': date.trim(),
      'page': page,
      'limit': limit,
    };

    final unpaidOrders = await _getList('/cashier/unpaid-orders', query: query);
    final unpaidBills = await _getList('/cashier/unpaid-bills', query: query)
        .catchError((_) => <Map<String, dynamic>>[]);

    final rows = [...unpaidOrders, ...unpaidBills];
    rows.sort((a, b) {
      final aDate = DateTime.tryParse(
              '${a['bill_date'] ?? a['created_at'] ?? a['created_at']}') ??
          DateTime.fromMillisecondsSinceEpoch(0);
      final bDate = DateTime.tryParse(
              '${b['bill_date'] ?? b['created_at'] ?? b['created_at']}') ??
          DateTime.fromMillisecondsSinceEpoch(0);
      return bDate.compareTo(aDate);
    });
    return rows;
  }

  Future<List<Map<String, dynamic>>> getVoidedOrders({
    String? search,
    int page = 1,
    int limit = 50,
  }) {
    return _getList('/cashier/unpaid-orders', query: {
      'status': 'voided',
      if (search != null && search.trim().isNotEmpty) 'search': search.trim(),
      'page': page,
      'limit': limit,
    });
  }

  Future<Map<String, dynamic>> createUnpaidBill(Map<String, dynamic> body) =>
      _postMap('/cashier/unpaid-bills', _withoutEmptyOptionalUuids(body));

  Future<Map<String, dynamic>> recordUnpaidBillPayment(
    String id,
    Map<String, dynamic> body,
  ) =>
      _postMap('/cashier/unpaid-bills/$id/payment', body);

  Future<Map<String, dynamic>> clearWaiterOrder(
    String source,
    String id,
    Map<String, dynamic> body,
  ) =>
      _patchMap('/cashier/unpaid-orders/$source/$id/pay', body);

  Future<Map<String, dynamic>> confirmUnpaidBill(String id, String role) =>
      _patchMap('/cashier/unpaid-bills/$id/confirm', {'role': role});

  Future<Uint8List> downloadUnpaidBillsPdf({
    String? date,
    String? status,
    String? search,
  }) async {
    try {
      final res = await _dio.get<List<int>>(
        '/cashier/unpaid-bills/outstanding/pdf',
        queryParameters: {
          if (date != null && date.trim().isNotEmpty) 'date': date.trim(),
          if (status != null && status != 'all') 'status': status,
          if (search != null && search.trim().isNotEmpty)
            'search': search.trim(),
        },
        options: Options(responseType: ResponseType.bytes),
      );
      return Uint8List.fromList(res.data ?? const []);
    } on DioException catch (error) {
      throw Exception(apiErrorMessage(error));
    }
  }

  Future<List<Map<String, dynamic>>> getCreditBills({
    String? status,
    String? billType,
    String? search,
    String? date,
    int page = 1,
    int limit = 25,
  }) {
    return _getList('/cashier/credit-bills', query: {
      if (status != null && status != 'all') 'status': status,
      if (billType != null && billType != 'all') 'bill_type': billType,
      if (search != null && search.trim().isNotEmpty) 'search': search.trim(),
      if (date != null && date.trim().isNotEmpty) 'date': date.trim(),
      'page': page,
      'limit': limit,
    });
  }

  Future<Map<String, dynamic>> createCreditBill(Map<String, dynamic> body) =>
      _postMap('/cashier/credit-bills', _withoutEmptyOptionalUuids(body));

  Future<Map<String, dynamic>> recordCreditPayment(
    String id,
    Map<String, dynamic> body,
  ) =>
      _postMap('/cashier/credit-bills/$id/payment', body);

  Future<Map<String, dynamic>> confirmCreditBill(String id, String role) =>
      _patchMap('/cashier/credit-bills/$id/confirm', {'role': role});

  // Paid bills: staff settling money toward their credit during the shift.
  Future<Map<String, dynamic>> getPaidBills() => _getMap('/cashier/paid-bills');

  Future<Map<String, dynamic>> recordPaidBill(Map<String, dynamic> body) =>
      _postMap('/cashier/paid-bills', body);

  Future<List<Map<String, dynamic>>> getShifts({
    String? status,
    String? from,
    String? to,
    int page = 1,
    int limit = 30,
  }) {
    return _getList('/cashier/shifts', query: {
      if (status != null && status != 'all') 'status': status,
      if (from != null) 'from_date': from,
      if (to != null) 'to_date': to,
      'page': page,
      'limit': limit,
    });
  }

  Future<Map<String, dynamic>> getShift(String id) =>
      _getMap('/cashier/shifts/$id');

  Future<Map<String, dynamic>> startShift(num openingFloat) =>
      _postMap('/cashier/shifts/start', {'opening_float': openingFloat});

  Future<Map<String, dynamic>> closeShift(
    String id,
    Map<String, dynamic> body,
  ) =>
      _putMap('/cashier/shifts/$id/close', body);

  Future<Map<String, dynamic>> reconcileShift(
    String id,
    Map<String, dynamic> body,
  ) =>
      _putMap('/cashier/shifts/$id/reconcile', body);

  Future<List<Map<String, dynamic>>> getBranchStaff({
    String? search,
    int limit = 500,
  }) async {
    try {
      return await _getList('/staff', query: {
        'limit': limit,
        'status': 'active',
        if (search != null && search.trim().isNotEmpty) 'search': search.trim(),
      });
    } on DioException catch (error) {
      if (error.response?.statusCode == 404 ||
          error.response?.statusCode == 403) {
        return [];
      }
      rethrow;
    }
  }

  Future<Map<String, dynamic>> createPOSTransaction(
          Map<String, dynamic> body) =>
      _postMap('/cashier/pos/transactions', body);

  Future<List<Map<String, dynamic>>> getPOSItems({String? search}) async {
    final res = await _dio.get(
      '/cashier/pos/items',
      queryParameters: {
        if (search != null && search.trim().isNotEmpty) 'search': search.trim(),
      },
      options: Options(
        validateStatus: (status) =>
            status == 404 || (status != null && status >= 200 && status < 300),
      ),
    );
    if (res.statusCode == 404) return [];
    return _asList(res.data);
  }

  Future<Map<String, dynamic>> payPOSTransaction(
    String id,
    Map<String, dynamic> body,
  ) =>
      _postMap('/cashier/pos/transactions/$id/pay', body);

  Future<Map<String, dynamic>> getPOSReconciliation({
    String? date,
    int? branchId,
  }) {
    return _getMap('/cashier/pos/reconciliation', query: {
      if (date != null) 'date': date,
      if (branchId != null) 'branch_id': branchId,
    });
  }

  Future<Map<String, dynamic>> scanPOSBarcode(String barcode) =>
      getBillDetails(barcode);

  Future<List<Map<String, dynamic>>> searchMpesa({
    num? amount,
    String? phone,
    int limit = 10,
  }) {
    return _getList('/payments/mpesa/search', query: {
      if (amount != null) 'amount': amount,
      if (phone != null && phone.trim().isNotEmpty) 'phone': phone.trim(),
      'limit': limit,
    });
  }

  Future<Map<String, dynamic>> initiateMpesa({
    required String phone,
    required num amount,
    required String accountReference,
  }) {
    return _postMap('/payments/mpesa/initiate', {
      'phoneNumber': phone,
      'amount': amount,
      'accountReference': accountReference,
      'description': 'Cashier payment $accountReference',
    });
  }

  Future<Map<String, dynamic>> getMpesaStatus(String checkoutRequestId) =>
      _getMap('/payments/mpesa/status/$checkoutRequestId');

  Future<Map<String, dynamic>> getPosInsights({
    int? branchId,
    int days = 7,
  }) async {
    try {
      final res =
          await _pythonDio.get('/api/analytics/pos/insights', queryParameters: {
        if (branchId != null) 'branch_id': branchId,
        'days': days,
      });
      return _asMap(res.data);
    } on DioException {
      return {};
    }
  }

  Future<Map<String, dynamic>> _getMap(
    String path, {
    Map<String, dynamic>? query,
  }) async {
    try {
      final res = await _dio.get(path, queryParameters: query);
      return _asMap(res.data);
    } on DioException catch (error) {
      throw Exception(apiErrorMessage(error));
    }
  }

  Future<List<Map<String, dynamic>>> _getList(
    String path, {
    Map<String, dynamic>? query,
  }) async {
    try {
      final res = await _dio.get(path, queryParameters: query);
      return _asList(res.data);
    } on DioException catch (error) {
      throw Exception(apiErrorMessage(error));
    }
  }

  Future<Map<String, dynamic>> _postMap(String path, Object? body) async {
    try {
      final res = await _dio.post(path, data: body);
      return _asMap(res.data);
    } on DioException catch (error) {
      throw Exception(apiErrorMessage(error));
    }
  }

  Future<Map<String, dynamic>> _patchMap(String path, Object? body) async {
    try {
      final res = await _dio.patch(path, data: body);
      return _asMap(res.data);
    } on DioException catch (error) {
      throw Exception(apiErrorMessage(error));
    }
  }

  Future<Map<String, dynamic>> _putMap(String path, Object? body) async {
    try {
      final res = await _dio.put(path, data: body);
      return _asMap(res.data);
    } on DioException catch (error) {
      throw Exception(apiErrorMessage(error));
    }
  }

  Map<String, dynamic> _asMap(dynamic value) {
    if (value is Map<String, dynamic>) return value;
    if (value is Map) return Map<String, dynamic>.from(value);
    return {};
  }

  List<Map<String, dynamic>> _asList(dynamic value) {
    final data = value is Map ? value['data'] ?? value['items'] ?? [] : value;
    if (data is List) {
      return data
          .whereType<Map>()
          .map((item) => Map<String, dynamic>.from(item))
          .toList();
    }
    return [];
  }
}
