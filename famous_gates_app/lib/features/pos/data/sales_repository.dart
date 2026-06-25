import 'dart:convert';
import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:uuid/uuid.dart';
import '../../../core/database/app_database.dart';
import '../../../core/network/dio_client.dart';
import '../../../core/storage/secure_storage_provider.dart';
import '../../../services/connectivity_service.dart';
import '../../auth/data/auth_repository.dart';
import '../domain/models.dart';

final salesRepositoryProvider = Provider<SalesRepository>((ref) {
  return SalesRepository(
    ref.read(dioProvider),
    ref.read(appDatabaseProvider).offlineSalesDao,
    ref,
  );
});

class SalesRepository {
  SalesRepository(this._dio, this._offlineSalesDao, this._ref);

  final Dio _dio;
  final OfflineSalesDao _offlineSalesDao;
  final Ref _ref;
  final _uuid = const Uuid();

  Future<SaleResult> createSale(CreateSaleRequest request) async {
    final storage = _ref.read(secureStorageProvider);
    final branchId = await storage.read(key: AuthRepository.branchIdKey) ?? '';
    final cashierId = await storage.read(key: AuthRepository.userIdKey) ?? '';
    final cashierName =
        await storage.read(key: AuthRepository.userNameKey) ?? '';
    final localId = _uuid.v4();
    final createdAt = DateTime.now();

    final online = await checkIsOnline();
    if (online) {
      try {
        final response = await _dio.post(
          '/cashier/pos/transactions',
          data: request.toJson(),
          options: Options(
            headers: {
              'Idempotency-Key': 'pos-sale-$localId',
              'X-Client-Id': cashierId,
            },
          ),
        );
        final payload = Map<String, dynamic>.from(response.data as Map);
        final data = (payload['data'] as Map<String, dynamic>?) ?? payload;
        return SaleResult(
          transactionId:
              '${data['transaction_id'] ?? data['transactionId'] ?? ''}',
          createdAt: createdAt,
          cashierName: cashierName,
          total: request.totalAmount,
        );
      } on DioException {
        await _queueOffline(localId, branchId, cashierId, request, createdAt);
      }
    } else {
      await _queueOffline(localId, branchId, cashierId, request, createdAt);
    }

    return SaleResult(
      transactionId: 'OFFLINE-${localId.substring(0, 8)}',
      createdAt: createdAt,
      cashierName: cashierName,
      total: request.totalAmount,
      offlineQueued: true,
    );
  }

  Future<PayTransactionResult> payTransaction(
      String transactionId, PayTransactionRequest request) async {
    final response = await _dio.post(
        '/cashier/pos/transactions/$transactionId/pay',
        data: request.toJson());
    return PayTransactionResult.fromJson(
        Map<String, dynamic>.from(response.data as Map));
  }

  Future<Map<String, dynamic>> sendRestaurantOrderToKitchen(
    CreateSaleRequest request, {
    required String paymentMethod,
  }) async {
    final storage = _ref.read(secureStorageProvider);
    final branchId = await storage.read(key: AuthRepository.branchIdKey);
    final response = await _dio.post('/restaurant/orders', data: {
      'order_type': 'takeaway',
      'guest_name': request.customerName ?? 'Walk-in',
      'payment_method': paymentMethod.toLowerCase(),
      'status': 'confirmed',
      if (branchId != null && branchId.isNotEmpty) 'branch_id': branchId,
      'items': request.items
          .map((item) => {
                'menu_item_id': item.productId,
                'name': item.name,
                'quantity': item.qty,
                'unit_price': item.unitPrice,
              })
          .toList(),
    }, options: Options(headers: {
      'Idempotency-Key': 'restaurant-order-${_uuid.v4()}',
    }));
    final payload = Map<String, dynamic>.from(response.data as Map);
    return Map<String, dynamic>.from((payload['data'] as Map?) ?? payload);
  }

  Future<MpesaStatus> initiateMpesa(MpesaInitiateRequest request) async {
    final response = await _dio.post(
      '/payments/mpesa/initiate',
      data: request.toJson(),
      options: Options(headers: {
        'Idempotency-Key': 'mpesa-initiate-${request.accountReference}',
      }),
    );
    final payload = Map<String, dynamic>.from(response.data as Map);
    final data = (payload['data'] as Map<String, dynamic>?) ?? payload;
    return MpesaStatus(
      status: data['checkout_request_id'] != null ? 'pending' : 'failed',
    );
  }

  Future<String> initiateMpesaSTK(
      String phone, double amount, String reference) async {
    final response = await _dio.post(
      '/payments/mpesa/initiate',
      data: {
        'phoneNumber': phone,
        'amount': amount,
        'accountReference': reference,
      },
      options: Options(headers: {
        'Idempotency-Key': 'mpesa-stk-$reference',
      }),
    );
    final payload = Map<String, dynamic>.from(response.data as Map);
    final data = (payload['data'] as Map<String, dynamic>?) ?? payload;
    return '${data['checkout_request_id'] ?? data['checkoutRequestId']}';
  }

  Future<MpesaStatus> checkMpesaStatus(String checkoutRequestId) async {
    final response =
        await _dio.get('/payments/mpesa/status/$checkoutRequestId');
    return MpesaStatus.fromJson(
        Map<String, dynamic>.from(response.data as Map));
  }

  Future<void> _queueOffline(
    String localId,
    String branchId,
    String cashierId,
    CreateSaleRequest request,
    DateTime createdAt,
  ) {
    final cartItems = request.items;
    final subtotal =
        cartItems.fold<double>(0, (sum, item) => sum + item.lineTotal);
    return _offlineSalesDao.insertSale(
      OfflineSaleEntry(
        localId: localId,
        branchId: branchId,
        cashierId: cashierId,
        itemsJson:
            jsonEncode(request.items.map((item) => item.toJson()).toList()),
        subtotal: subtotal,
        vatAmount: subtotal * 0.16,
        total: request.totalAmount,
        paymentMethod: 'cash',
        mpesaRef: null,
        roomNumber: null,
        createdAt: createdAt.millisecondsSinceEpoch,
        syncStatus: 'pending',
      ),
    );
  }
}
